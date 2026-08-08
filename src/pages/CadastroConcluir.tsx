import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoFull } from "@/components/common/Logo";
import {
  provisionSelfServiceTenant,
  readSignupIntent,
} from "@/services/self-service-signup";

const CadastroConcluir = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const intent = readSignupIntent();
  const metadataOffice = typeof user?.user_metadata?.office_name === "string"
    ? user.user_metadata.office_name
    : "";
  const [officeName, setOfficeName] = useState(intent.displayName ?? metadataOffice);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finish = async (name: string) => {
    setLoading(true);
    setError("");
    try {
      await provisionSelfServiceTenant(name);
      track("self_signup_provisioned", { provider: user?.app_metadata?.provider ?? "callback" });
      window.location.assign("/onboarding");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível preparar o escritório.");
      setLoading(false);
    }
  };

  useEffect(() => {
    const automaticName = (intent.displayName ?? metadataOffice).trim();
    if (automaticName) void finish(automaticName);
    // A intenção é lida uma vez após o retorno do provedor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-xl shadow-slate-900/5">
        <LogoFull size="md" className="mb-8" />
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#2563EB]"><Building2 /></div>
        <h1 className="text-2xl font-semibold text-[#081B48]">Preparando seu escritório</h1>
        {loading ? (
          <div className="mt-6"><div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#2563EB]" /></div><p className="mt-3 text-sm text-slate-500">Configurando seu teste gratuito e ambiente seguro...</p></div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void finish(officeName.trim()); }}>
            <div className="space-y-2"><Label htmlFor="callbackOffice">Nome do escritório</Label><Input id="callbackOffice" value={officeName} onChange={(e) => setOfficeName(e.target.value)} minLength={2} required /></div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Button className="w-full bg-[#2563EB]" type="submit">Continuar</Button>
            <Button className="w-full" variant="ghost" type="button" onClick={() => navigate("/login")}>Voltar ao login</Button>
          </form>
        )}
      </section>
    </main>
  );
};

export default CadastroConcluir;
