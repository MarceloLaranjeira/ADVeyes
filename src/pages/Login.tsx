import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { withTimeout } from "@/lib/async-timeout";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
    <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 3.1 7.5l3.4 2.7A5.9 5.9 0 0 1 12 6.1Z" />
  </svg>
);

const BrandLogo = ({ className = "" }: { className?: string }) => (
  <img
    src="/brand/adv-ta-on-club-dark.png"
    alt="ADV Tá On Club"
    className={`object-contain object-left ${className}`}
  />
);

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const requestedNext = new URLSearchParams(window.location.search).get("next");
  const nextPath = requestedNext?.startsWith("/") &&
      !requestedNext.startsWith("//")
    ? requestedNext
    : "/";

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Informe o e-mail",
        description: "Digite seu e-mail para receber o link de redefinição.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    toast(error
      ? { title: "Erro ao enviar e-mail", description: error.message, variant: "destructive" }
      : { title: "E-mail enviado", description: "Verifique sua caixa de entrada para redefinir a senha." });
    setLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Não foi possível entrar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    navigate(nextPath);
  };

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}${nextPath}`,
            skipBrowserRedirect: true,
          },
        }),
      );
      if (error) throw error;
      if (!data.url) throw new Error("O Google não retornou uma URL de acesso.");
      window.location.assign(data.url);
    } catch (error) {
      toast({
        title: "Não foi possível entrar com Google",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
      setLoadingGoogle(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/10 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="relative hidden overflow-hidden bg-[#13273E] px-14 py-12 text-white lg:flex lg:flex-col">
          <div className="absolute -right-40 -top-36 h-96 w-96 rounded-full bg-[#2563EB]/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#D4AF6A]/10 blur-3xl" />
          <BrandLogo className="relative z-10 h-[88px] w-[300px]" />

          <div className="relative z-10 my-auto max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-100">
              <Sparkles className="h-4 w-4 text-[#D9B66F]" /> Gestão jurídica em um só lugar
            </div>
            <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
              Sua advocacia organizada todos os dias.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-blue-100/85">
              Acompanhe processos, intimações, prazos e toda a rotina do escritório com segurança e clareza.
            </p>
            <div className="mt-10 grid gap-4 text-sm text-blue-50">
              {["Monitoramento oficial de publicações", "Prazos e tarefas centralizados", "Dados protegidos por escritório"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500/25">
                    <Check className="h-4 w-4" />
                  </span>
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
            <div className="mb-10 rounded-2xl bg-[#13273E] px-5 py-2 lg:hidden">
              <BrandLogo className="h-16 w-56" />
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Bem-vindo de volta</p>
              <h2 className="mt-2 text-3xl font-semibold text-[#081B48]">Entre no ADV Tá On Club</h2>
              <p className="mt-2 text-slate-500">Acesse o ambiente seguro do seu escritório.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail profissional</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@escritorio.com.br"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#2563EB] hover:underline"
                    onClick={() => void handleForgotPassword()}
                    disabled={loading}
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  minLength={6}
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-12 w-full bg-[#2563EB] hover:bg-[#1d4ed8]"
                disabled={loading || loadingGoogle}
              >
                {loading ? "Entrando..." : <>Entrar na plataforma <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-slate-400">ou</span></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full gap-3"
              onClick={() => void handleGoogleLogin()}
              disabled={loading || loadingGoogle}
            >
              <GoogleIcon />
              {loadingGoogle ? "Abrindo o Google..." : "Continuar com Google"}
            </Button>

            <p className="mt-6 text-center text-sm text-slate-500">
              Ainda não tem conta?{" "}
              <Link to="/cadastro" className="font-semibold text-[#2563EB] hover:underline">
                Criar conta grátis
              </Link>
            </p>
            <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
              Ao continuar, você concorda com os <Link to="/termos" className="underline">Termos de Uso</Link> e a <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
