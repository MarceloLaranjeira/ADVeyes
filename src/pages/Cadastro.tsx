import { useState } from "react";
import { track } from "@vercel/analytics";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoFull } from "@/components/common/Logo";
import {
  provisionSelfServiceTenant,
  rememberSignupIntent,
} from "@/services/self-service-signup";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
    <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 3.1 7.5l3.4 2.7A5.9 5.9 0 0 1 12 6.1Z" />
  </svg>
);

const Cadastro = () => {
  const [fullName, setFullName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateNames = () => {
    if (fullName.trim().length < 2 || officeName.trim().length < 2) {
      toast({
        title: "Complete seus dados",
        description: "Informe seu nome e o nome do escritório.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateNames()) return;
    setLoading(true);
    track("self_signup_started", { provider: "email" });
    rememberSignupIntent({ displayName: officeName.trim(), fullName: fullName.trim() });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/cadastro/concluir`,
          data: {
            full_name: fullName.trim(),
            office_name: officeName.trim(),
            signup_intent: "self_service",
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        await provisionSelfServiceTenant(officeName.trim());
        track("self_signup_provisioned", { provider: "email" });
        window.location.assign("/onboarding");
        return;
      }
      setConfirmation(true);
    } catch (error) {
      toast({
        title: "Não foi possível criar sua conta",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!validateNames()) return;
    setGoogleLoading(true);
    track("self_signup_started", { provider: "google" });
    rememberSignupIntent({ displayName: officeName.trim(), fullName: fullName.trim() });
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/cadastro/concluir`,
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        }),
      );
      if (error) throw error;
      if (!data.url) throw new Error("O Google não retornou uma URL de acesso.");
      window.location.assign(data.url);
    } catch (error) {
      toast({
        title: "Não foi possível continuar com Google",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/10 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="relative hidden overflow-hidden bg-[#081B48] px-14 py-12 text-white lg:flex lg:flex-col">
          <div className="absolute -right-40 -top-36 h-96 w-96 rounded-full bg-[#2563EB]/25 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <LogoFull dark size="lg" className="relative z-10" />
          <div className="relative z-10 my-auto max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-100">
              <Sparkles className="h-4 w-4 text-yellow-300" /> 14 dias gratuitos, sem cartão
            </div>
            <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
              Sua advocacia organizada desde o primeiro acesso.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-blue-100/85">
              Processos, intimações, tarefas e gestão do escritório em uma experiência simples e segura.
            </p>
            <div className="mt-10 grid gap-4 text-sm text-blue-50">
              {["Monitoramento oficial de publicações", "Prazos com revisão humana", "Dados isolados por escritório"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500/25"><Check className="h-4 w-4" /></span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="relative z-10 flex items-center gap-2 text-xs text-blue-200/70">
            <ShieldCheck className="h-4 w-4" /> Ambiente protegido e preparado para a rotina jurídica.
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 xl:px-20">
          <div className="w-full max-w-lg">
            <LogoFull size="md" className="mb-10 lg:hidden" />
            {confirmation ? (
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700"><Check className="h-8 w-8" /></div>
                <h2 className="mt-6 text-3xl font-semibold text-[#081B48]">Confirme seu e-mail</h2>
                <p className="mt-3 leading-relaxed text-slate-600">
                  Enviamos um link para <strong>{email}</strong>. Ao confirmar, seu escritório será preparado automaticamente.
                </p>
                <Button variant="outline" className="mt-8" onClick={() => navigate("/login")}>Ir para o login</Button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Comece agora</p>
                  <h2 className="mt-2 text-3xl font-semibold text-[#081B48]">Crie seu escritório no ADVeyes</h2>
                  <p className="mt-2 text-slate-500">Leva menos de dois minutos. Não pedimos cartão.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="fullName">Seu nome</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" autoComplete="name" required /></div>
                    <div className="space-y-2"><Label htmlFor="officeName">Nome do escritório</Label><Input id="officeName" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="Ex.: Silva Advocacia" required /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="signupEmail">E-mail profissional</Label><Input id="signupEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@escritorio.com.br" autoComplete="email" required /></div>
                  <div className="space-y-2"><Label htmlFor="signupPassword">Crie uma senha</Label><Input id="signupPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} required /></div>
                  <Button type="submit" className="h-12 w-full bg-[#2563EB] hover:bg-[#1d4ed8]" disabled={loading || googleLoading}>
                    {loading ? "Criando sua conta..." : <>Criar conta grátis <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </form>
                <div className="relative my-5"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-slate-400">ou</span></div></div>
                <Button type="button" variant="outline" className="h-12 w-full gap-3" onClick={handleGoogle} disabled={loading || googleLoading}><GoogleIcon />{googleLoading ? "Abrindo o Google..." : "Continuar com Google"}</Button>
                <p className="mt-6 text-center text-sm text-slate-500">Já tem uma conta? <Link to="/login" className="font-semibold text-[#2563EB] hover:underline">Entrar</Link></p>
                <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">Ao continuar, você concorda com os <Link to="/termos" className="underline">Termos de Uso</Link> e a <Link to="/privacidade" className="underline">Política de Privacidade</Link>.</p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default Cadastro;
