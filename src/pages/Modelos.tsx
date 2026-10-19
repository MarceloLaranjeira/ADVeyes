import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { officeService, type DocumentTemplate } from "@/services/office";

const blank = { id: null as string | null, nome: "", categoria: "", conteudo: "" };

const Modelos = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.tenantId ?? null;
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const report = useCallback((error: unknown, action: string) => {
    toast({ title: `Não foi possível ${action}`, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
  }, [toast]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      setTemplates(await officeService.listTemplates(tenantId));
    } catch (error) {
      report(error, "carregar os modelos");
    }
  }, [report, tenantId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !user || !form.nome.trim()) return;
    setSaving(true);
    try {
      await officeService.saveTemplate(tenantId, user.id, {
        id: form.id, nome: form.nome, categoria: form.categoria.trim() || null, conteudo: form.conteudo,
      });
      setForm(blank);
      await load();
    } catch (error) {
      report(error, "salvar o modelo");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (template: DocumentTemplate, ativo: boolean) => {
    if (!tenantId) return;
    try {
      await officeService.setTemplateActive(tenantId, template.id, ativo);
      await load();
    } catch (error) {
      report(error, "atualizar o modelo");
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-serif tracking-tight">Modelos</h1>
          <p className="text-muted-foreground text-sm mt-1">Modelos de documento do escritório, para reaproveitar em petições e contratos.</p>
        </div>

        <Card><CardContent className="p-6">
          <form onSubmit={save} className="space-y-3">
            <h2 className="text-sm font-semibold">{form.id ? "Editar modelo" : "Novo modelo"}</h2>
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <Input aria-label="Nome do modelo" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={160} />
              <Input aria-label="Categoria" placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} maxLength={80} />
            </div>
            <Textarea aria-label="Conteúdo do modelo" placeholder="Texto do modelo" rows={10} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving || !form.nome.trim()} className="gap-1">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar modelo
              </Button>
              {form.id && <Button type="button" variant="outline" size="sm" onClick={() => setForm(blank)}>Cancelar edição</Button>}
            </div>
          </form>
        </CardContent></Card>

        <Card><CardContent className="p-6">
          <h2 className="text-sm font-semibold mb-3">Meus modelos</h2>
          {templates.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p> : (
            <ul className="divide-y">
              {templates.map((template) => (
                <li key={template.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <button type="button" className={`text-left hover:underline ${template.ativo ? "" : "text-muted-foreground line-through"}`}
                    onClick={() => setForm({ id: template.id, nome: template.nome, categoria: template.categoria ?? "", conteudo: template.conteudo })}>
                    {template.nome}{template.categoria ? ` · ${template.categoria}` : ""}
                  </button>
                  <Switch checked={template.ativo} aria-label={`Ativar ${template.nome}`} onCheckedChange={(checked) => void toggle(template, checked)} />
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>
      </div>
    </AppLayout>
  );
};

export default Modelos;
