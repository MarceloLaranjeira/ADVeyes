import { useCallback, useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Clock3, Newspaper, Scale, Users } from "lucide-react";
import { LogoFull } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { legalIntegrationService } from "@/services/legal-integration";
import { readOnboarding, updateOnboarding, type OnboardingRow } from "@/services/onboarding";
import { supabase } from "@/integrations/supabase/client";

const STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export default function Onboarding() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [onboarding, setOnboarding] = useState<OnboardingRow | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabState, setOabState] = useState("AM");
  const [working, setWorking] = useState(false);
  const [found, setFound] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant || !user) return;
    const [progress, professional] = await Promise.all([
      readOnboarding(currentTenant.tenantId),
      supabase.from("equipe").select("id, oab").eq("tenant_id", currentTenant.tenantId).eq("user_id", user.id).maybeSingle(),
    ]);
    setOnboarding(progress);
    if (professional.data) {
      setProfessionalId(professional.data.id);
      if (professional.data.oab) setOabNumber(professional.data.oab.replace(/\D/g, ""));
    }
  }, [currentTenant, user]);

  useEffect(() => { void load(); }, [load]);

  const saveOab = async () => {
    if (!currentTenant || !professionalId || !oabNumber.trim()) return;
    setWorking(true);
    try {
      const result = await legalIntegrationService.register({ tenantId: currentTenant.tenantId, professionalId, oabNumber, oabState });
      const next = await updateOnboarding(currentTenant.tenantId, {
        current_step: "team", oab_completed_at: new Date().toISOString(), oab_skipped_at: null, dismissed_at: null,
      });
      setOnboarding(next);
      setFound(result.totalCandidates ?? 0);
      track("onboarding_oab_completed", { state: oabState, discoveryPending: true });
    } catch (error) {
      toast({ title: "Não foi possível cadastrar a OAB", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setWorking(false); }
  };

  const skipOab = async () => {
    if (!currentTenant) return;
    setWorking(true);
    try {
      setOnboarding(await updateOnboarding(currentTenant.tenantId, {
        current_step: "team", oab_skipped_at: new Date().toISOString(), oab_completed_at: null,
      }));
      track("onboarding_oab_skipped");
    } finally { setWorking(false); }
  };

  const finish = async (inviteTeam: boolean) => {
    if (!currentTenant || !onboarding) return;
    setWorking(true);
    const now = new Date().toISOString();
    try {
      if (onboarding.oab_completed_at) {
        await updateOnboarding(currentTenant.tenantId, {
          current_step: "complete", team_completed_at: inviteTeam ? now : null,
          team_skipped_at: inviteTeam ? null : now, completed_at: now, dismissed_at: null,
        });
      } else {
        await updateOnboarding(currentTenant.tenantId, { current_step: "oab", team_skipped_at: now, dismissed_at: now });
      }
      navigate(inviteTeam ? "/equipe" : "/");
      track("onboarding_finished", { oabCompleted: Boolean(onboarding.oab_completed_at), inviteTeam });
    } catch (error) {
      toast({ title: "Não foi possível concluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setWorking(false); }
  };

  if (!currentTenant || !onboarding) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="h-9 w-9 animate-spin rounded-full border-b-2 border-[#2563EB]" /></div>;
  const teamStep = onboarding.current_step === "team" || found !== null;

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/10 lg:grid-cols-[0.86fr_1.14fr]">
        <aside className="relative overflow-hidden bg-[#081B48] p-8 text-white sm:p-12">
          <LogoFull dark size="md" />
          <div className="mt-16"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Primeiros passos</p><h1 className="mt-3 text-3xl font-semibold leading-tight">Seu escritório já está pronto. Agora vamos ativar a inteligência jurídica.</h1>
            <div className="mt-10 space-y-5">
              {[{ icon: Scale, title: "Processos pela OAB", text: "Localizamos e importamos automaticamente os processos encontrados nas bases públicas." }, { icon: Newspaper, title: "Diário Oficial", text: "Acompanhamos novas publicações associadas ao cadastro." }, { icon: Clock3, title: "Prazos sob controle", text: "Sugestões automáticas sempre passam pela confirmação humana." }].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/25"><Icon className="h-5 w-5" /></span><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-relaxed text-blue-100/70">{text}</p></div></div>
              ))}
            </div>
          </div>
        </aside>
        <section className="flex items-center justify-center p-7 sm:p-12 lg:p-16"><div className="w-full max-w-xl">
          <div className="mb-10 flex gap-2">{[0, 1, 2].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= (teamStep ? 2 : 1) ? "bg-[#2563EB]" : "bg-slate-200"}`} />)}</div>
          {!teamStep ? <>
            <p className="text-sm font-semibold text-[#2563EB]">Etapa 2 de 3</p><h2 className="mt-2 text-3xl font-semibold text-[#081B48]">Cadastre sua OAB</h2><p className="mt-3 leading-relaxed text-slate-600">Usaremos esses dados para procurar processos nas bases públicas e conciliar publicações do Diário da Justiça.</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-[1fr_160px]"><div className="space-y-2"><Label htmlFor="oabNumber">Número da OAB</Label><Input id="oabNumber" inputMode="numeric" value={oabNumber} onChange={(e) => setOabNumber(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 10099" /></div><div className="space-y-2"><Label>Seccional (UF)</Label><Select value={oabState} onValueChange={setOabState}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent></Select></div></div>
            {!professionalId && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Estamos terminando de preparar seu perfil profissional. Atualize a página em alguns segundos.</p>}
            <Button className="mt-7 h-12 w-full bg-[#2563EB]" disabled={working || !professionalId || !oabNumber} onClick={() => void saveOab()}>{working ? "Salvando OAB e ativando monitoramento..." : <>Buscar processos e ativar monitoramento <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
            <button className="mt-5 w-full text-sm text-slate-500 hover:text-slate-800" disabled={working} onClick={() => void skipOab()}>Informar a OAB mais tarde</button>
          </> : <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700"><Check className="h-8 w-8" /></div><p className="mt-6 text-sm font-semibold text-[#2563EB]">Etapa 3 de 3</p><h2 className="mt-2 text-3xl font-semibold text-[#081B48]">Tudo certo para começar</h2>
            <p className="mt-4 leading-relaxed text-slate-600">{onboarding.oab_completed_at ? `Sua OAB foi cadastrada. A busca continuará no servidor e os processos encontrados serão importados automaticamente. As publicações oficiais serão conciliadas com seu escritório.` : "Você pode entrar agora e retomar o cadastro da OAB pelo painel quando quiser."}</p>
            <div className="mt-8 rounded-2xl border bg-slate-50 p-5 text-left"><div className="flex gap-3"><Users className="mt-0.5 h-5 w-5 text-[#2563EB]" /><div><p className="font-semibold text-[#081B48]">Trabalha com alguém?</p><p className="mt-1 text-sm text-slate-500">Você pode convidar um colaborador agora ou fazer isso depois.</p></div></div></div>
            <Button className="mt-6 h-12 w-full bg-[#2563EB]" disabled={working} onClick={() => void finish(false)}>{working ? "Concluindo..." : "Entrar no meu painel"}</Button><Button className="mt-3 w-full" variant="outline" disabled={working} onClick={() => void finish(true)}>Convidar colaborador</Button>
          </div>}
        </div></section>
      </div>
    </main>
  );
}
