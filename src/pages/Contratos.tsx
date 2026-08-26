import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { carteiraAtiva } from "@/lib/carteira";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Edit, Trash2, Copy, Download,
  Search, Filter, Eye, BookOpen, Zap, Bot,
} from "lucide-react";
import jsPDF from "jspdf";

const tiposTemplate = ["contrato", "peticao", "recurso", "notificacao", "procuracao", "acordo", "parecer", "oficio", "outro"];
const areasTemplate = ["Cível", "Criminal", "Trabalhista", "Família", "Empresarial", "Tributário", "Previdenciário", "Geral"];

// Templates padrão incluídos no sistema
const templatesDefault = [
  {
    titulo: "Contrato de Honorários Advocatícios",
    tipo: "contrato",
    area: "Geral",
    variaveis: ["CLIENTE_NOME", "CLIENTE_CPF", "ADVOGADO_NOME", "OAB", "VALOR_HONORARIOS", "OBJETO", "DATA"],
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

Pelo presente instrumento particular, de um lado:

**CONTRATANTE:** {{CLIENTE_NOME}}, portador(a) do CPF nº {{CLIENTE_CPF}}, doravante denominado(a) simplesmente CONTRATANTE;

**CONTRATADO:** Dr(a). {{ADVOGADO_NOME}}, advogado(a) inscrito(a) na OAB/{{OAB}}, doravante denominado(a) simplesmente CONTRATADO;

As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços Advocatícios, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.

**CLÁUSULA 1ª – DO OBJETO**
O CONTRATADO prestará serviços de advocacia ao CONTRATANTE referente a: {{OBJETO}}.

**CLÁUSULA 2ª – DOS HONORÁRIOS**
Pelos serviços ora contratados, o CONTRATANTE pagará ao CONTRATADO o valor de R$ {{VALOR_HONORARIOS}} ({{VALOR_HONORARIOS}} reais).

**CLÁUSULA 3ª – DAS DESPESAS**
Todas as despesas processuais (custas, emolumentos, pericias, etc.) correrão por conta exclusiva do CONTRATANTE.

**CLÁUSULA 4ª – DA VIGÊNCIA**
O presente contrato vigorará até o trânsito em julgado da decisão final, incluindo a fase de execução.

**CLÁUSULA 5ª – DO FORO**
As partes elegem o foro da Comarca onde se encontra o objeto deste contrato para dirimir quaisquer dúvidas oriundas do presente instrumento.

E por estarem assim justos e contratados, firmam o presente instrumento em duas vias de igual teor e forma.

{{DATA}}

_______________________________
CONTRATANTE: {{CLIENTE_NOME}}

_______________________________
CONTRATADO: Dr(a). {{ADVOGADO_NOME}} — OAB/{{OAB}}`,
  },
  {
    titulo: "Procuração Ad Judicia",
    tipo: "procuracao",
    area: "Geral",
    variaveis: ["CLIENTE_NOME", "CLIENTE_CPF", "CLIENTE_ENDERECO", "ADVOGADO_NOME", "OAB", "PODERES", "DATA"],
    conteudo: `INSTRUMENTO PARTICULAR DE PROCURAÇÃO AD JUDICIA

Pelo presente instrumento, {{CLIENTE_NOME}}, CPF nº {{CLIENTE_CPF}}, residente e domiciliado à {{CLIENTE_ENDERECO}}, nomeia e constitui seu bastante procurador o(a) Dr(a). {{ADVOGADO_NOME}}, advogado(a) inscrito(a) na OAB/{{OAB}}, a quem confere amplos poderes para:

{{PODERES}}

Podendo ainda o mandatário substabelecer esta em outro colega de profissão, com ou sem reserva de iguais poderes.

{{DATA}}

_______________________________
Outorgante: {{CLIENTE_NOME}}`,
  },
  {
    titulo: "Notificação Extrajudicial",
    tipo: "notificacao",
    area: "Geral",
    variaveis: ["DESTINATARIO_NOME", "DESTINATARIO_ENDERECO", "CLIENTE_NOME", "FATO", "PRAZO", "DATA", "ADVOGADO_NOME", "OAB"],
    conteudo: `NOTIFICAÇÃO EXTRAJUDICIAL

{{DESTINATARIO_NOME}}
{{DESTINATARIO_ENDERECO}}

Senhor(a),

Vimos, por meio desta, notificá-lo(a), em nome de nosso(a) cliente {{CLIENTE_NOME}}, acerca do seguinte:

{{FATO}}

Diante do exposto, notificamos V.Sas. para que, no prazo de {{PRAZO}} dias úteis a contar do recebimento desta notificação, tome as providências necessárias para regularizar a situação descrita, sob pena de adotarmos todas as medidas judiciais cabíveis, incluindo ação judicial para reparação de danos.

Certos de vossa compreensão, aguardamos.

{{DATA}}

Dr(a). {{ADVOGADO_NOME}}
OAB/{{OAB}}`,
  },
];

const Contratos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Record<string, any>[]>([]);
  const [documentos, setDocumentos] = useState<Record<string, any>[]>([]);
  const [processos, setProcessos] = useState<Record<string, any>[]>([]);
  const [clientes, setClientes] = useState<Record<string, any>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showUso, setShowUso] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Record<string, any> | null>(null);
  const [editTemplate, setEditTemplate] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [previewContent, setPreviewContent] = useState("");
  const [form, setForm] = useState({
    titulo: "", tipo: "contrato", area: "Geral",
    conteudo: "", ativo: true,
  });

  const fetchData = async () => {
    const [tRes, dRes, pRes, cRes] = await Promise.all([
      (supabase.from as any)("contratos_templates").select("*").order("uso_count", { ascending: false }),
      (supabase.from as any)("documentos_gerados").select("*, contratos_templates(titulo), clientes(nome), processos(numero)").order("created_at", { ascending: false }).limit(20),
      carteiraAtiva(supabase.from("processos").select("id, numero")).order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome").order("nome"),
    ]);
    if (tRes.data) setTemplates(tRes.data);
    if (dRes.data) setDocumentos(dRes.data);
    if (pRes.data) setProcessos(pRes.data);
    if (cRes.data) setClientes(cRes.data);
  };

  const seedDefaultTemplates = async () => {
    for (const t of templatesDefault) {
      await (supabase.from as any)("contratos_templates").insert({
        ...t, user_id: user!.id, variaveis: t.variaveis,
      });
    }
    fetchData();
    toast({ title: "Templates padrão carregados!" });
  };

  useEffect(() => { fetchData(); }, []);

  const filteredTemplates = templates.filter((t) => {
    const matchSearch = !search || t.titulo.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === "todos" || t.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const resetForm = () => {
    setForm({ titulo: "", tipo: "contrato", area: "Geral", conteudo: "", ativo: true });
    setEditTemplate(null);
  };

  const openEdit = (t: Record<string, any>) => {
    setForm({ titulo: t.titulo, tipo: t.tipo, area: t.area || "Geral", conteudo: t.conteudo, ativo: t.ativo });
    setEditTemplate(t);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }
    setLoading(true);
    // Extract variables from content ({{VAR_NAME}})
    const vars = [...form.conteudo.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
    const uniqueVars = [...new Set(vars)];
    const payload = { ...form, variaveis: uniqueVars, user_id: user!.id };
    const { error } = editTemplate
      ? await (supabase.from as any)("contratos_templates").update(payload).eq("id", editTemplate.id)
      : await (supabase.from as any)("contratos_templates").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editTemplate ? "Template atualizado!" : "Template criado!" });
      resetForm(); setShowForm(false); fetchData();
    }
    setLoading(false);
  };

  const openUso = (t: Record<string, any>) => {
    setSelectedTemplate(t);
    const initVars: Record<string, string> = {};
    (t.variaveis || []).forEach((v: string) => { initVars[v] = ""; });
    setVarValues(initVars);
    setShowUso(true);
  };

  const generatePreview = () => {
    let content = selectedTemplate?.conteudo || "";
    Object.entries(varValues).forEach(([k, v]) => {
      content = content.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || `[${k}]`);
    });
    setPreviewContent(content);
    setShowPreview(true);
  };

  const saveDocument = async (titulo: string) => {
    let content = selectedTemplate?.conteudo || "";
    Object.entries(varValues).forEach(([k, v]) => {
      content = content.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || `[${k}]`);
    });
    await (supabase.from as any)("documentos_gerados").insert({
      titulo, conteudo: content, template_id: selectedTemplate?.id,
      user_id: user!.id, status: "rascunho",
    });
    await (supabase.from as any)("contratos_templates").update({ uso_count: (selectedTemplate?.uso_count || 0) + 1 }).eq("id", selectedTemplate?.id);
    toast({ title: "Documento salvo!" });
    setShowUso(false);
    fetchData();
  };

  const exportPDF = (content: string, titulo: string) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(content.replace(/\*\*/g, ""), 180);
    let y = 20;
    lines.forEach((line: string) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, 15, y);
      y += 5;
    });
    doc.save(`${titulo.replace(/\s+/g, "_")}.pdf`);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await (supabase.from as any)("contratos_templates").delete().eq("id", id);
    toast({ title: "Template excluído" });
    fetchData();
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Contratos & Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">Modelos de documentos jurídicos reutilizáveis</p>
          </div>
          <div className="flex items-center gap-2">
            {templates.length === 0 && (
              <Button variant="outline" onClick={seedDefaultTemplates} className="gap-2">
                <Zap className="w-4 h-4" /> Carregar Templates Padrão
              </Button>
            )}
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Template
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Templates Cadastrados</p><p className="text-2xl font-bold">{templates.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><FileText className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Documentos Gerados</p><p className="text-2xl font-bold">{documentos.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><Zap className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">Mais Usado</p><p className="text-sm font-bold truncate">{templates[0]?.titulo || "—"}</p></div>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar template..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[180px]"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tiposTemplate.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {filteredTemplates.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum template encontrado</p>
            </div>
          )}
          {filteredTemplates.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{t.titulo}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{t.tipo}</span>
                      {t.area && <span className="text-xs text-muted-foreground">{t.area}</span>}
                    </div>
                  </div>
                </div>
                {t.variaveis?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Variáveis:</p>
                    <div className="flex flex-wrap gap-1">
                      {t.variaveis.slice(0, 4).map((v: string) => (
                        <span key={v} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                      ))}
                      {t.variaveis.length > 4 && <span className="text-[10px] text-muted-foreground">+{t.variaveis.length - 4}</span>}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>Usado {t.uso_count || 0}x</span>
                  {!t.ativo && <span className="text-muted-foreground bg-muted px-2 py-0.5 rounded">Inativo</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openUso(t)} className="flex-1 gap-1 h-8">
                    <Zap className="w-3 h-3" /> Usar Template
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(t)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteTemplate(t.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Documentos Gerados */}
        {documentos.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h3 className="font-serif font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Documentos Gerados Recentemente
              </h3>
              <div className="space-y-2">
                {documentos.slice(0, 10).map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{d.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.contratos_templates?.titulo || "Template"} • {new Date(d.created_at).toLocaleDateString("pt-BR")}
                        {d.clientes?.nome && ` • ${d.clientes.nome}`}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => exportPDF(d.conteudo, d.titulo)}>
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Template Dialog */}
        <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editTemplate ? "Editar Template" : "Novo Template"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Título *</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Nome do template" required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{tiposTemplate.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Área</Label>
                  <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{areasTemplate.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-2 gap-3">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} id="ativo-t" />
                  <Label htmlFor="ativo-t">Template ativo</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conteúdo do Template *</Label>
                <p className="text-xs text-muted-foreground">Use {`{{NOME_VARIAVEL}}`} para criar campos substituíveis</p>
                <Textarea
                  value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  placeholder="Digite o conteúdo do documento. Use {{CLIENTE_NOME}}, {{DATA}}, etc. para variáveis."
                  rows={16}
                  className="font-mono text-xs"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editTemplate ? "Atualizar" : "Criar Template"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Uso do Template Dialog */}
        <Dialog open={showUso} onOpenChange={setShowUso}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Usar Template: {selectedTemplate?.titulo}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Preencha os campos abaixo para personalizar o documento:</p>
              {Object.keys(varValues).map((varName) => (
                <div key={varName} className="space-y-1.5">
                  <Label className="capitalize">{varName.replace(/_/g, " ")}</Label>
                  <Input
                    value={varValues[varName]}
                    onChange={(e) => setVarValues({ ...varValues, [varName]: e.target.value })}
                    placeholder={`Digite ${varName.replace(/_/g, " ").toLowerCase()}...`}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowUso(false)}>Cancelar</Button>
                <Button variant="outline" onClick={generatePreview} className="gap-2">
                  <Eye className="w-4 h-4" /> Visualizar
                </Button>
                <Button onClick={() => saveDocument(`${selectedTemplate?.titulo} — ${new Date().toLocaleDateString("pt-BR")}`)} className="gap-2">
                  <FileText className="w-4 h-4" /> Gerar Documento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Prévia do Documento</DialogTitle></DialogHeader>
            <div className="bg-white border rounded-lg p-8">
              <pre className="whitespace-pre-wrap text-sm font-serif leading-relaxed">{previewContent}</pre>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
              <Button onClick={() => exportPDF(previewContent, selectedTemplate?.titulo || "documento")} className="gap-2">
                <Download className="w-4 h-4" /> Exportar PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Contratos;
