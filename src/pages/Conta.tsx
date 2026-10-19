import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";

const FIELDS = [
  { key: "razao_social", label: "Nome ou razão social", max: 200 },
  { key: "nome_fantasia", label: "Nome fantasia", max: 200 },
  { key: "documento", label: "CPF ou CNPJ", max: 20 },
  { key: "cidade", label: "Cidade", max: 120 },
  { key: "estado", label: "Estado (UF)", max: 2 },
  { key: "celular", label: "Celular", max: 40 },
  { key: "telefone", label: "Telefone", max: 40 },
  { key: "email", label: "E-mail do escritório", max: 254 },
] as const;

type FieldKey = typeof FIELDS[number]["key"];
type Profile = Record<FieldKey | "pais", string>;

const EMPTY: Profile = {
  razao_social: "", nome_fantasia: "", documento: "", pais: "Brasil", cidade: "",
  estado: "", celular: "", telefone: "", email: "",
};

const PLAN_STATUS: Record<string, string> = {
  trial: "Período de teste", pending: "Aguardando pagamento", active: "Ativo",
  overdue: "Pagamento em atraso", cancelled: "Cancelado",
};

export default function Conta() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { plan, status, trialDaysLeft } = usePlan();
  const tenantId = currentTenant?.tenantId ?? null;
  const canEdit = currentTenant ? ["owner", "admin"].includes(currentTenant.role) : false;
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data, error } = await supabase.from("escritorio_perfil").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (error) {
      toast({ title: "Não foi possível carregar os dados", description: error.message, variant: "destructive" });
      return;
    }
    setProfile(data ? {
      razao_social: data.razao_social ?? "", nome_fantasia: data.nome_fantasia ?? "", documento: data.documento ?? "",
      pais: data.pais, cidade: data.cidade ?? "", estado: data.estado ?? "", celular: data.celular ?? "",
      telefone: data.telefone ?? "", email: data.email ?? "",
    } : EMPTY);
  }, [tenantId, toast]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !user) return;
    setSaving(true);
    const blank = (value: string) => value.trim() || null;
    const { error } = await supabase.from("escritorio_perfil").upsert({
      tenant_id: tenantId, updated_by: user.id, pais: profile.pais.trim() || "Brasil",
      razao_social: blank(profile.razao_social), nome_fantasia: blank(profile.nome_fantasia),
      documento: blank(profile.documento), cidade: blank(profile.cidade),
      estado: blank(profile.estado)?.toUpperCase() ?? null, celular: blank(profile.celular),
      telefone: blank(profile.telefone), email: blank(profile.email),
    });
    setSaving(false);
    toast(error
      ? { title: "Não foi possível salvar", description: error.message, variant: "destructive" }
      : { title: "Dados do escritório salvos" });
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6 max-w-3xl">
        <div>
          <h1 className="text-4xl font-bold font-serif tracking-tight">Conta e assinatura</h1>
          <p className="text-muted-foreground text-sm mt-1">Dados do escritório, plano e termos de uso.</p>
        </div>

        <Card><CardContent className="p-6">
          <form onSubmit={save} className="space-y-4">
            <h2 className="text-sm font-semibold">Dados do escritório</h2>
            <p className="text-xs text-muted-foreground">O logotipo e as cores ficam em Configurações → Geral.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`conta-${field.key}`}>{field.label}</Label>
                  <Input id={`conta-${field.key}`} value={profile[field.key]} maxLength={field.max} disabled={!canEdit}
                    onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="conta-pais">País</Label>
                <Input id="conta-pais" value={profile.pais} maxLength={80} disabled={!canEdit}
                  onChange={(e) => setProfile({ ...profile, pais: e.target.value })} />
              </div>
            </div>
            {canEdit ? (
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar dados
              </Button>
            ) : <p className="text-xs text-muted-foreground">Só proprietários e administradores alteram estes dados.</p>}
          </form>
        </CardContent></Card>

        <Card><CardContent className="p-6 space-y-3">
          <h2 className="text-sm font-semibold">Plano e pagamento</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Plano</dt><dd className="font-medium capitalize">{plan}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Situação</dt><dd className="font-medium">{PLAN_STATUS[status] ?? status}</dd></div>
            {status === "trial" && <div><dt className="text-xs text-muted-foreground">Teste termina em</dt><dd className="font-medium">{trialDaysLeft} dia(s)</dd></div>}
          </dl>
          <Button asChild variant="outline"><Link to="/checkout">Ver planos e contratar</Link></Button>
        </CardContent></Card>

        <Card><CardContent className="p-6">
          <h2 className="text-sm font-semibold mb-2">Termos de uso</h2>
          <p className="text-sm text-muted-foreground mb-3">As regras de uso da plataforma e o tratamento de dados.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/termos">Termos de uso</Link></Button>
            <Button asChild variant="outline"><Link to="/privacidade">Política de privacidade</Link></Button>
          </div>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
}
