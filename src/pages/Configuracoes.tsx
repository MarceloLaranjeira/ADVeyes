import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { User, Bell, Shield, Palette, Moon, Sun, Plus, Pencil, Trash2, Key, CheckCircle, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const tribunaisDisponiveis = [
  { id: "tjam", nome: "TJAM - Tribunal de Justiça do Amazonas" },
  { id: "trf1", nome: "TRF1 - Tribunal Regional Federal da 1ª Região" },
  { id: "stj", nome: "STJ - Superior Tribunal de Justiça" },
  { id: "stf", nome: "STF - Supremo Tribunal Federal" },
  { id: "tst", nome: "TST - Tribunal Superior do Trabalho" },
  { id: "trt11", nome: "TRT11 - Tribunal Regional do Trabalho da 11ª Região" },
];

const emptyForm = { tribunal: "", token_acesso: "", numero_oab: "", seccional_oab: "", cpf: "" };

const Configuracoes = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [credenciais, setCredenciais] = useState<any[]>([]);
  const [showCredForm, setShowCredForm] = useState(false);
  const [editCred, setEditCred] = useState<any>(null);
  const [deleteCred, setDeleteCred] = useState<string | null>(null);
  const [credForm, setCredForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const fetchCredenciais = async () => {
    const { data } = await supabase.from("tribunal_credenciais").select("*").order("created_at");
    if (data) setCredenciais(data);
  };

  useEffect(() => { fetchCredenciais(); }, []);

  const openNewCred = () => { setEditCred(null); setCredForm(emptyForm); setShowCredForm(true); };
  const openEditCred = (c: any) => {
    setEditCred(c);
    setCredForm({ tribunal: c.tribunal, token_acesso: c.token_acesso || "", numero_oab: c.numero_oab || "", seccional_oab: c.seccional_oab || "", cpf: c.cpf || "" });
    setShowCredForm(true);
  };

  const handleCredSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credForm.tribunal) { toast({ title: "Selecione o tribunal", variant: "destructive" }); return; }
    setLoading(true);
    const tribunalInfo = tribunaisDisponiveis.find(t => t.id === credForm.tribunal);
    const payload = {
      ...credForm, user_id: user!.id, nome_tribunal: tribunalInfo?.nome || credForm.tribunal,
      tipo_autenticacao: "token", ativo: true, updated_at: new Date().toISOString(),
    };
    const { error } = editCred
      ? await supabase.from("tribunal_credenciais").update(payload).eq("id", editCred.id)
      : await supabase.from("tribunal_credenciais").insert(payload);
    if (error) {
      if (error.code === "23505") toast({ title: "Credencial já existe para este tribunal", variant: "destructive" });
      else toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editCred ? "Credencial atualizada!" : "Credencial cadastrada!" });
      setShowCredForm(false);
      fetchCredenciais();
    }
    setLoading(false);
  };

  const handleDeleteCred = async () => {
    if (!deleteCred) return;
    await supabase.from("tribunal_credenciais").delete().eq("id", deleteCred);
    toast({ title: "Credencial removida!" });
    setDeleteCred(null);
    fetchCredenciais();
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Configurações gerais do sistema e integrações</p>
        </div>

        <div className="max-w-3xl space-y-6">
          {/* Aparência */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Palette className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Aparência</h3>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Tema</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Alterne entre tema claro e escuro</p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-muted-foreground" />
                  <Switch checked={theme === "dark"} onCheckedChange={(c) => setTheme(c ? "dark" : "light")} />
                  <Moon className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credenciais dos Tribunais */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Credenciais dos Tribunais</h3>
                </div>
                <Button size="sm" onClick={openNewCred} className="gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Configure seus tokens de acesso e dados da OAB para integração com os sistemas dos tribunais (PJe, MNI, APIs públicas).
              </p>

              {credenciais.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
                  Nenhuma credencial configurada. Adicione seus tokens para habilitar as integrações.
                </div>
              ) : (
                <div className="space-y-3">
                  {credenciais.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        {c.ativo ? <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" /> : <XCircle className="w-4 h-4 text-destructive" />}
                        <div>
                          <p className="text-sm font-medium">{c.nome_tribunal}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {c.numero_oab && <span>OAB: {c.numero_oab}/{c.seccional_oab}</span>}
                            <span>Token: {c.token_acesso ? "••••••" + c.token_acesso.slice(-4) : "Não definido"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCred(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteCred(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Perfil */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4"><User className="w-5 h-5 text-primary" /><h3 className="font-semibold">Perfil</h3></div>
              <p className="text-sm text-muted-foreground">Gerencie suas informações de perfil e dados do escritório.</p>
            </CardContent>
          </Card>

          {/* Notificações */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4"><Bell className="w-5 h-5 text-primary" /><h3 className="font-semibold">Notificações</h3></div>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><Label className="text-sm">Notificações por e-mail</Label><Switch /></div>
                <div className="flex items-center justify-between"><Label className="text-sm">Alertas de prazos</Label><Switch defaultChecked /></div>
                <div className="flex items-center justify-between"><Label className="text-sm">Novas publicações</Label><Switch defaultChecked /></div>
                <div className="flex items-center justify-between"><Label className="text-sm">Movimentações processuais</Label><Switch defaultChecked /></div>
              </div>
            </CardContent>
          </Card>

          {/* Integrações */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4"><Shield className="w-5 h-5 text-primary" /><h3 className="font-semibold">Integrações Ativas</h3></div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] px-2.5 py-1 rounded-full font-medium">✓ API DataJud (CNJ)</span>
                <span className="text-xs bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] px-2.5 py-1 rounded-full font-medium">✓ Lovable AI</span>
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">PJe / MNI</span>
                <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Google Calendar</span>
                <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">WhatsApp</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground italic">
                As integrações PJe/MNI requerem credenciais válidas configuradas acima. O peticionamento eletrônico via PJe requer certificado digital A1/A3.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Credential Form Dialog */}
        <Dialog open={showCredForm} onOpenChange={setShowCredForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editCred ? "Editar Credencial" : "Nova Credencial de Tribunal"}</DialogTitle></DialogHeader>
            <form onSubmit={handleCredSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tribunal *</Label>
                <Select value={credForm.tribunal} onValueChange={(v) => setCredForm({ ...credForm, tribunal: v })} disabled={!!editCred}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tribunal" /></SelectTrigger>
                  <SelectContent>{tribunaisDisponiveis.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Número OAB</Label><Input value={credForm.numero_oab} onChange={(e) => setCredForm({ ...credForm, numero_oab: e.target.value })} placeholder="12345" /></div>
                <div className="space-y-2"><Label>Seccional</Label><Input value={credForm.seccional_oab} onChange={(e) => setCredForm({ ...credForm, seccional_oab: e.target.value })} placeholder="AM" /></div>
              </div>
              <div className="space-y-2"><Label>CPF</Label><Input value={credForm.cpf} onChange={(e) => setCredForm({ ...credForm, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
              <div className="space-y-2">
                <Label>Token de Acesso / API Key</Label>
                <Input type="password" value={credForm.token_acesso} onChange={(e) => setCredForm({ ...credForm, token_acesso: e.target.value })} placeholder="Cole aqui o token do tribunal" />
                <p className="text-xs text-muted-foreground">Token JWT ou API Key fornecido pelo sistema do tribunal.</p>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowCredForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editCred ? "Atualizar" : "Cadastrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteCred} onOpenChange={(o) => !o && setDeleteCred(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover credencial?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação removerá a credencial do tribunal. Você poderá recadastrá-la depois.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCred} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
