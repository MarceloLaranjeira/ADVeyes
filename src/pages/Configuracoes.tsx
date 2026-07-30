import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  User, Bell, Shield, Palette, Moon, Sun, Plus, Pencil, Trash2,
  Key, CheckCircle, XCircle, Volume2, Mic, Zap, Bot, RefreshCw,
  CreditCard, Crown, Clock, Star, ArrowRight, Link2, Link2Off,
  SlidersHorizontal, RefreshCcw, Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { PLANS } from "@/lib/asaas";
import {
  googleCalendar,
  type GoogleCalendarStatus,
} from "@/lib/google-calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/components/theme/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useToast } from "@/hooks/use-toast";

type TribunalCredencial = Tables<"tribunal_credenciais">;

// ─── Perfil do Advogado + OAB Sync ──────────────────────────────────────────
const PERFIL_KEY = "lexia_perfil_advogado";

const PerfilAdvogadoForm = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PERFIL_KEY) || "{}"); } catch { return {}; }
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem("adveyes_last_oab_sync"));

  const sincronizarOAB = async (oab: string, seccional: string) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("oab-sync", {
        body: {
          oab_numero: oab,
          seccional,
          nome_advogado: form.nome || "",
        },
      });

      if (error) throw error;

      const agora = new Date().toLocaleString("pt-BR");
      localStorage.setItem("adveyes_last_oab_sync", agora);
      setLastSync(agora);

      if ((data?.novos ?? 0) > 0 || (data?.atualizados ?? 0) > 0) {
        toast({
          title: "🦅 Horus concluiu a descoberta!",
          description: `${data.novos} novo(s) e ${data.atualizados} atualizado(s) de ${data.sincronizados} processos encontrados.`,
        });
      } else {
        toast({
          title: "🦅 Horus concluiu a varredura",
          description: data?.message ?? "Nenhum processo encontrado vinculado a essa OAB.",
        });
      }
    } catch (e) {
      toast({ title: "Erro no sync OAB", description: (e as Error).message, variant: "destructive" });
    }
    setSyncing(false);
  };

  const salvar = async () => {
    localStorage.setItem(PERFIL_KEY, JSON.stringify(form));
    if (form.numero_oab && form.seccional) {
      const valor = `${form.numero_oab}/${form.seccional}`.toUpperCase();
      const perfis = JSON.parse(localStorage.getItem("lexia_perfis_monitorados") || "[]");
      const jaExiste = perfis.some((p: { tipo: string; valor: string }) => p.tipo === "oab" && p.valor === valor);
      if (!jaExiste) {
        perfis.unshift({ id: "perfil-principal", tipo: "oab", valor, tribunais: [], criadoEm: new Date().toISOString() });
        localStorage.setItem("lexia_perfis_monitorados", JSON.stringify(perfis));
      }
      // Auto-trigger OAB sync
      await sincronizarOAB(form.numero_oab, form.seccional);
    } else {
      toast({ title: "Perfil salvo!" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Número OAB</Label>
          <Input
            placeholder="Ex: 10099"
            value={form.numero_oab || ""}
            onChange={(e) => setForm({ ...form, numero_oab: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Seccional (Estado)</Label>
          <Input
            placeholder="Ex: AM"
            maxLength={2}
            value={form.seccional || ""}
            onChange={(e) => setForm({ ...form, seccional: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">CPF</Label>
        <Input
          placeholder="000.000.000-00"
          value={form.cpf || ""}
          onChange={(e) => setForm({ ...form, cpf: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Nome completo</Label>
        <Input
          placeholder="Dr. Nome do Advogado"
          value={form.nome || ""}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">E-mail</Label>
        <Input
          type="email"
          placeholder="seu@email.com"
          value={form.email || ""}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
        <strong>🦅 Horus</strong> consulta as fontes judiciais configuradas para localizar processos vinculados à sua OAB. A cobertura depende dos dados disponibilizados por cada tribunal.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={salvar} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {syncing ? "🦅 Horus buscando processos..." : "🦅 Salvar & Descobrir Processos"}
        </Button>
        {form.numero_oab && form.seccional && (
          <Button
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={() => sincronizarOAB(form.numero_oab, form.seccional)}
            className="gap-2"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> 🦅 Redescobrir Processos
          </Button>
        )}
        {lastSync && (
          <span className="text-xs text-muted-foreground">Último sync: {lastSync}</span>
        )}
      </div>
    </div>
  );
};

// ─── Importar Processos Manualmente ─────────────────────────────────────────
const ImportarProcessos = () => {
  const { toast } = useToast();
  const [numeros, setNumeros] = useState("");
  const [tribunal, setTribunal] = useState("TJAM");
  const [importing, setImporting] = useState(false);

  const importar = async () => {
    const lista = numeros
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lista.length === 0) {
      toast({ title: "Informe ao menos um número de processo", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("dje-discovery", {
        body: { modo: "import", tribunal, numeros: lista },
      });
      if (error) throw error;
      toast({
        title: "✅ Processos importados",
        description: data?.message ?? `${data?.novos ?? 0} processo(s) adicionado(s).`,
      });
      setNumeros("");
    } catch (e) {
      toast({ title: "Erro ao importar", description: (e as Error).message, variant: "destructive" });
    }
    setImporting(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        O TJAM não disponibiliza dados de advogados no DataJud. Acesse{" "}
        <a
          href="https://consultasaj.tjam.jus.br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          consultasaj.tjam.jus.br
        </a>{" "}
        com seu login, copie os números dos seus processos e cole abaixo.
      </p>
      <div className="flex gap-2">
        <select
          className="border rounded-md px-2 py-1.5 text-sm bg-background"
          value={tribunal}
          onChange={(e) => setTribunal(e.target.value)}
        >
          <option value="TJAM">TJAM</option>
          <option value="STJ">STJ</option>
          <option value="TRF1">TRF1</option>
          <option value="TRT11">TRT11</option>
        </select>
      </div>
      <Textarea
        placeholder={"Cole os números CNJ aqui, um por linha:\n0000000-00.0000.8.04.0001\n0000001-00.0000.8.04.0001"}
        value={numeros}
        onChange={(e) => setNumeros(e.target.value)}
        rows={5}
        className="font-mono text-xs"
      />
      <Button onClick={importar} disabled={importing} className="gap-2">
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {importing ? "Importando..." : "Importar & Monitorar"}
      </Button>
    </div>
  );
};

const tribunaisDisponiveis = [
  // Superiores
  { id: "stf", nome: "STF - Supremo Tribunal Federal" },
  { id: "stj", nome: "STJ - Superior Tribunal de Justiça" },
  { id: "tst", nome: "TST - Tribunal Superior do Trabalho" },
  { id: "stm", nome: "STM - Superior Tribunal Militar" },
  { id: "tse", nome: "TSE - Tribunal Superior Eleitoral" },
  // TRFs
  { id: "trf1", nome: "TRF1 - Tribunal Regional Federal da 1ª Região" },
  { id: "trf2", nome: "TRF2 - Tribunal Regional Federal da 2ª Região" },
  { id: "trf3", nome: "TRF3 - Tribunal Regional Federal da 3ª Região" },
  { id: "trf4", nome: "TRF4 - Tribunal Regional Federal da 4ª Região" },
  { id: "trf5", nome: "TRF5 - Tribunal Regional Federal da 5ª Região" },
  { id: "trf6", nome: "TRF6 - Tribunal Regional Federal da 6ª Região" },
  // Estaduais
  { id: "tjac", nome: "TJAC - Tribunal de Justiça do Acre" },
  { id: "tjal", nome: "TJAL - Tribunal de Justiça de Alagoas" },
  { id: "tjam", nome: "TJAM - Tribunal de Justiça do Amazonas" },
  { id: "tjap", nome: "TJAP - Tribunal de Justiça do Amapá" },
  { id: "tjba", nome: "TJBA - Tribunal de Justiça da Bahia" },
  { id: "tjce", nome: "TJCE - Tribunal de Justiça do Ceará" },
  { id: "tjdft", nome: "TJDFT - Tribunal de Justiça do DF e Territórios" },
  { id: "tjes", nome: "TJES - Tribunal de Justiça do Espírito Santo" },
  { id: "tjgo", nome: "TJGO - Tribunal de Justiça de Goiás" },
  { id: "tjma", nome: "TJMA - Tribunal de Justiça do Maranhão" },
  { id: "tjmg", nome: "TJMG - Tribunal de Justiça de Minas Gerais" },
  { id: "tjms", nome: "TJMS - Tribunal de Justiça de Mato Grosso do Sul" },
  { id: "tjmt", nome: "TJMT - Tribunal de Justiça de Mato Grosso" },
  { id: "tjpa", nome: "TJPA - Tribunal de Justiça do Pará" },
  { id: "tjpb", nome: "TJPB - Tribunal de Justiça da Paraíba" },
  { id: "tjpe", nome: "TJPE - Tribunal de Justiça de Pernambuco" },
  { id: "tjpi", nome: "TJPI - Tribunal de Justiça do Piauí" },
  { id: "tjpr", nome: "TJPR - Tribunal de Justiça do Paraná" },
  { id: "tjrj", nome: "TJRJ - Tribunal de Justiça do Rio de Janeiro" },
  { id: "tjrn", nome: "TJRN - Tribunal de Justiça do Rio Grande do Norte" },
  { id: "tjro", nome: "TJRO - Tribunal de Justiça de Rondônia" },
  { id: "tjrr", nome: "TJRR - Tribunal de Justiça de Roraima" },
  { id: "tjrs", nome: "TJRS - Tribunal de Justiça do Rio Grande do Sul" },
  { id: "tjsc", nome: "TJSC - Tribunal de Justiça de Santa Catarina" },
  { id: "tjse", nome: "TJSE - Tribunal de Justiça de Sergipe" },
  { id: "tjsp", nome: "TJSP - Tribunal de Justiça de São Paulo" },
  { id: "tjto", nome: "TJTO - Tribunal de Justiça do Tocantins" },
  // TRTs
  ...Array.from({ length: 24 }, (_, i) => ({
    id: `trt${i + 1}`,
    nome: `TRT${i + 1} - Tribunal Regional do Trabalho da ${i + 1}ª Região`,
  })),
  // Sistemas especiais
  { id: "seeu", nome: "SEEU - Sistema Eletrônico de Execução Unificado" },
  { id: "projudi", nome: "Projudi - Processo Judicial Digital" },
];

const emptyForm = { tribunal: "", token_acesso: "", numero_oab: "", seccional_oab: "", cpf: "" };

const Configuracoes = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const {
    subscription,
    plan: currentPlan,
    status: currentStatus,
    trialDaysLeft,
  } = useSubscription();
  const { toast } = useToast();
  const [credenciais, setCredenciais] = useState<TribunalCredencial[]>([]);
  const [showCredForm, setShowCredForm] = useState(false);
  const [editCred, setEditCred] = useState<TribunalCredencial | null>(null);
  const [deleteCred, setDeleteCred] = useState<string | null>(null);
  const [credForm, setCredForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(() => googleCalendar.isConnected());
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatus | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [showGcalDisconnectDialog, setShowGcalDisconnectDialog] = useState(false);

  const planData = {
    plan: currentPlan,
    status: currentStatus,
    trial_ends_at: subscription?.trial_ends_at ?? null,
  };

  useEffect(() => {
    const oauthResult = googleCalendar.handleOAuthResult();
    if (oauthResult?.connected) {
      toast({ title: "Google Calendar conectado com sucesso!" });
    } else if (oauthResult?.errorCode) {
      toast({
        title: "Não foi possível conectar o Google Calendar",
        description: oauthResult.errorCode === "access_denied"
          ? "A autorização foi cancelada."
          : "Tente novamente ou revise a configuração da integração.",
        variant: "destructive",
      });
    }

    if (user) {
      void googleCalendar.getStatus()
        .then((status) => {
          setGcalStatus(status);
          setGcalConnected(
            status.connected && status.connection?.status === "connected",
          );
        })
        .catch(() => setGcalConnected(false));
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGcalConnect = async () => {
    setGcalLoading(true);
    try {
      await googleCalendar.connect(`${window.location.origin}/configuracoes`);
    } catch {
      toast({
        title: "Não foi possível iniciar a conexão",
        description: "Revise a configuração OAuth do Google Calendar.",
        variant: "destructive",
      });
      setGcalLoading(false);
    }
  };

  const handleGcalSync = async () => {
    setGcalLoading(true);
    try {
      const result = await googleCalendar.syncNow();
      const status = await googleCalendar.getStatus();
      setGcalStatus(status);
      toast({
        title: `${result.completed} item(ns) sincronizado(s)`,
        description: result.retried
          ? `${result.retried} item(ns) serão tentados novamente.`
          : undefined,
      });
    } catch {
      toast({
        title: "Sincronização pendente",
        description: "O worker automático tentará novamente.",
        variant: "destructive",
      });
    } finally {
      setGcalLoading(false);
    }
  };

  const handleGcalDisconnect = async (removeEvents: boolean) => {
    setGcalLoading(true);
    try {
      const result = await googleCalendar.disconnect(removeEvents);
      setGcalConnected(false);
      setGcalStatus(null);
      setShowGcalDisconnectDialog(false);
      toast({
        title: "Google Calendar desconectado",
        description: removeEvents && result.failedRemovals
          ? `${result.failedRemovals} evento(s) podem precisar ser removidos manualmente.`
          : undefined,
      });
    } catch {
      toast({
        title: "Erro ao desconectar",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGcalLoading(false);
    }
  };

  // AI Custom Prompt (persisted in localStorage)
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem("horus_custom_prompt") || "");

  const saveCustomPrompt = () => {
    if (customPrompt.trim()) {
      localStorage.setItem("horus_custom_prompt", customPrompt.trim());
    } else {
      localStorage.removeItem("horus_custom_prompt");
    }
    toast({ title: "Prompt personalizado salvo!", description: "O Horus usará essas instruções em todas as conversas." });
  };

  // TTS Settings (persisted in sessionStorage for security — keys cleared when tab closes)
  const [ttsProvider, setTtsProvider] = useState(() => sessionStorage.getItem("horus_tts_provider") || "browser");
  const [ttsApiKey, setTtsApiKey] = useState(() => sessionStorage.getItem("horus_tts_key") || "");
  const [ttsVoice, setTtsVoice] = useState(() => sessionStorage.getItem("horus_tts_voice") || "nova");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState(() => sessionStorage.getItem("horus_11labs_voice") || "21m00Tcm4TlvDq8ikWAM");
  const [ttsEnabled, setTtsEnabled] = useState(() => sessionStorage.getItem("horus_tts_enabled") !== "false");

  const saveTtsSettings = () => {
    sessionStorage.setItem("horus_tts_provider", ttsProvider);
    sessionStorage.setItem("horus_tts_key", ttsApiKey);
    sessionStorage.setItem("horus_tts_voice", ttsVoice);
    sessionStorage.setItem("horus_11labs_voice", elevenLabsVoiceId);
    sessionStorage.setItem("horus_tts_enabled", String(ttsEnabled));
    // Clean up any old localStorage keys
    localStorage.removeItem("horus_tts_key");
    localStorage.removeItem("horus_tts_provider");
    localStorage.removeItem("horus_tts_voice");
    localStorage.removeItem("horus_11labs_voice");
    localStorage.removeItem("horus_tts_enabled");
    toast({ title: "Configurações de voz salvas!" });
  };

  const testTts = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance("Horus online. Sistema de voz funcionando perfeitamente.");
      u.lang = "pt-BR";
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    }
  };

  const fetchCredenciais = async () => {
    const { data } = await supabase.from("tribunal_credenciais").select("*").order("created_at");
    if (data) setCredenciais(data);
  };

  useEffect(() => { fetchCredenciais(); }, []);

  const openNewCred = () => { setEditCred(null); setCredForm(emptyForm); setShowCredForm(true); };
  const openEditCred = (c: TribunalCredencial) => {
    setEditCred(c);
    setCredForm({ tribunal: (c.tribunal as string) || "", token_acesso: (c.token_acesso as string) || "", numero_oab: (c.numero_oab as string) || "", seccional_oab: (c.seccional_oab as string) || "", cpf: (c.cpf as string) || "" });
    setShowCredForm(true);
  };

  const handleCredSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credForm.tribunal) { toast({ title: "Selecione o tribunal", variant: "destructive" }); return; }
    setLoading(true);
    const tribunalInfo = tribunaisDisponiveis.find(t => t.id === credForm.tribunal);
    const payload = {
      ...credForm,
      user_id: user!.id,
      nome_tribunal: tribunalInfo?.nome || credForm.tribunal,
      tipo_autenticacao: "token",
      ativo: true,
      updated_at: new Date().toISOString(),
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
          <h1 className="text-4xl font-bold font-serif tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Personalize o sistema, integrações e IA</p>
        </div>

        <Tabs defaultValue="geral" className="max-w-4xl">
          <TabsList className="mb-6 bg-muted/50 flex-wrap h-auto gap-1">
            <TabsTrigger value="geral" className="gap-2 text-xs"><Palette className="w-3.5 h-3.5" /> Geral</TabsTrigger>
            <TabsTrigger value="voz" className="gap-2 text-xs"><Volume2 className="w-3.5 h-3.5" /> Voz & IA</TabsTrigger>
            <TabsTrigger value="tribunais" className="gap-2 text-xs"><Key className="w-3.5 h-3.5" /> Tribunais</TabsTrigger>
            <TabsTrigger value="integracoes" className="gap-2 text-xs">
              <Zap className="w-3.5 h-3.5" /> Integrações
              {planData?.status === "trial" && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 ml-0.5" />}
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="gap-2 text-xs"><Bell className="w-3.5 h-3.5" /> Notificações</TabsTrigger>
          </TabsList>

          {/* === GERAL === */}
          <TabsContent value="geral" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Palette className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">Aparência</h3>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm font-medium">Tema do Sistema</Label>
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

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <User className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">Perfil do Advogado</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Usuário: <span className="font-medium text-foreground">{user?.email}</span>
                </p>
                <PerfilAdvogadoForm />
              </CardContent>
            </Card>

            {/* Importação manual de processos */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">Importar Processos Manualmente</h3>
                </div>
                <ImportarProcessos />
              </CardContent>
            </Card>
          </TabsContent>

          {/* === VOZ & IA === */}
          <TabsContent value="voz" className="space-y-4">

            {/* Prompt Personalizado */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">Prompt Personalizado do Horus</h3>
                  {customPrompt.trim() && (
                    <span className="ml-auto text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-semibold">Ativo</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Adicione instruções personalizadas que o Horus seguirá em <strong>todas as conversas</strong>, em qualquer modo.
                  Por exemplo: estilo de resposta, foco em determinadas áreas do direito, nome do escritório, tom formal ou informal.
                </p>
                <Textarea
                  className="min-h-[120px] text-sm font-mono resize-y"
                  placeholder={`Exemplos de instruções:\n- Sempre mencione o escritório Albertino Advogados Associados ao finalizar respostas\n- Foco em processos do TJAM e TRF1\n- Prefira linguagem formal e técnica\n- Sempre cite o número do artigo de lei quando relevante`}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                />
                <div className="flex items-center gap-3 mt-3">
                  <Button onClick={saveCustomPrompt} className="gap-2">
                    <CheckCircle className="w-4 h-4" /> Salvar Prompt
                  </Button>
                  {customPrompt.trim() && (
                    <Button
                      variant="ghost"
                      className="gap-2 text-muted-foreground hover:text-destructive"
                      onClick={() => { setCustomPrompt(""); localStorage.removeItem("horus_custom_prompt"); toast({ title: "Prompt personalizado removido" }); }}
                    >
                      <XCircle className="w-4 h-4" /> Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Essas instruções são adicionadas ao prompt base do Horus. O prompt base define o papel do assistente (jurídico, resumo, petição etc.) — suas instruções complementam e personalizam o comportamento.
                </p>
              </CardContent>
            </Card>

            {/* Horus AI Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Bot className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">Horus — Assistente de IA Jurídica</h3>
                  <span className="text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full ml-auto">Ativo</span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs font-semibold text-foreground mb-1">Como funciona o Horus</p>
                    <p className="text-xs text-muted-foreground">
                      O Horus é uma IA treinada para o direito brasileiro. Ele consulta legislação, analisa peças processuais,
                      gera petições e responde perguntas sobre jurisprudência. O modelo é executado via API Gemini (Google)
                      diretamente pelo servidor Supabase Edge Function <code className="bg-muted px-1 rounded">chat</code>.
                    </p>
                  </div>

                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs font-semibold text-foreground mb-2">Configuração da API de IA (backend)</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      A chave de API do modelo de linguagem deve ser configurada como <strong>Secret</strong> no
                      painel Supabase do projeto, na seção <strong>Edge Functions → Secrets</strong>.
                      Nunca exponha essas chaves no frontend.
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { secret: "GEMINI_API_KEY", desc: "Google AI Studio — model: gemini-1.5-pro", link: "aistudio.google.com" },
                        { secret: "OPENAI_API_KEY", desc: "OpenAI Platform — model: gpt-4o", link: "platform.openai.com" },
                        { secret: "ANTHROPIC_API_KEY", desc: "Anthropic Console — model: claude-3-5-sonnet", link: "console.anthropic.com" },
                      ].map((item) => (
                        <div key={item.secret} className="flex items-start gap-2 text-xs">
                          <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono shrink-0">{item.secret}</code>
                          <span className="text-muted-foreground">{item.desc} — <span className="italic">{item.link}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs font-semibold text-foreground mb-2">Modos disponíveis no Horus</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { mode: "assistente", desc: "Perguntas sobre legislação, prazos e procedimentos" },
                        { mode: "resumo", desc: "Resume petições, sentenças e acórdãos" },
                        { mode: "analise", desc: "Analisa contratos e documentos jurídicos" },
                        { mode: "peticao", desc: "Gera petições iniciais, recursos e defesas" },
                      ].map(m => (
                        <div key={m.mode} className="text-xs">
                          <span className="font-medium capitalize text-foreground">{m.mode}</span>
                          <p className="text-muted-foreground">{m.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-b">
                  <div>
                    <Label className="text-sm font-medium">Resposta por Voz (TTS)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Horus fala as respostas automaticamente</p>
                  </div>
                  <Switch checked={ttsEnabled} onCheckedChange={setTtsEnabled} />
                </div>

                <div className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Provedor de Voz (TTS)</Label>
                    <Select value={ttsProvider} onValueChange={setTtsProvider}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="browser">
                          <div>
                            <div className="font-medium">Navegador (Nativo)</div>
                            <div className="text-xs text-muted-foreground">Rápido, offline, sem custo</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="elevenlabs">
                          <div>
                            <div className="font-medium">ElevenLabs</div>
                            <div className="text-xs text-muted-foreground">Voz ultra-realista com API Key</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="openai">
                          <div>
                            <div className="font-medium">OpenAI TTS</div>
                            <div className="text-xs text-muted-foreground">Alloy, Nova, Echo — requer API Key</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="google">
                          <div>
                            <div className="font-medium">Google Cloud TTS</div>
                            <div className="text-xs text-muted-foreground">WaveNet voices — requer API Key</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {ttsProvider !== "browser" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        API Key — {ttsProvider === "elevenlabs" ? "ElevenLabs" : ttsProvider === "openai" ? "OpenAI" : "Google Cloud"}
                      </Label>
                      <Input
                        type="password"
                        value={ttsApiKey}
                        onChange={(e) => setTtsApiKey(e.target.value)}
                        placeholder={
                          ttsProvider === "elevenlabs" ? "sk-..." :
                          ttsProvider === "openai" ? "sk-..." :
                          "AIza..."
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {ttsProvider === "elevenlabs" && "Obtenha sua chave em elevenlabs.io — a chave é armazenada localmente no navegador"}
                        {ttsProvider === "openai" && "Obtenha sua chave em platform.openai.com — a chave é armazenada localmente no navegador"}
                        {ttsProvider === "google" && "Habilite a API Cloud TTS em console.cloud.google.com — a chave é armazenada localmente"}
                      </p>
                    </div>
                  )}

                  {ttsProvider === "openai" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Voz OpenAI</Label>
                      <Select value={ttsVoice} onValueChange={setTtsVoice}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["alloy", "nova", "echo", "fable", "onyx", "shimmer"].map(v => (
                            <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {ttsProvider === "elevenlabs" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Voice ID ElevenLabs</Label>
                      <Input
                        value={elevenLabsVoiceId}
                        onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                        placeholder="21m00Tcm4TlvDq8ikWAM"
                      />
                      <p className="text-xs text-muted-foreground">ID da voz no painel ElevenLabs (Voices)</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-medium">Reconhecimento de Voz</Label>
                    <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">Web Speech API</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usa a Web Speech API nativa. Funciona melhor no <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>.
                    Nenhuma configuração adicional necessária.
                  </p>
                </div>

                <div className="flex gap-3 mt-5 pt-4 border-t">
                  <Button onClick={saveTtsSettings} className="gap-2">
                    <Zap className="w-4 h-4" /> Salvar Configurações
                  </Button>
                  <Button variant="outline" onClick={testTts} className="gap-2">
                    <Volume2 className="w-4 h-4" /> Testar Voz
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TRIBUNAIS === */}
          <TabsContent value="tribunais" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold font-serif">Credenciais dos Tribunais</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchCredenciais} className="gap-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" onClick={openNewCred} className="gap-1">
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure tokens de acesso e dados da OAB para integração com todos os tribunais, PJe, SEEU e Projudi.
                  A API DataJud (CNJ) já está ativa para consulta pública — as credenciais habilitam peticionamento e funcionalidades avançadas.
                </p>

                {credenciais.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border rounded-xl border-dashed">
                    <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhuma credencial configurada. Adicione seus tokens para habilitar peticionamento eletrônico.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {credenciais.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          {c.ativo
                            ? <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
                            : <XCircle className="w-4 h-4 text-destructive" />}
                          <div>
                            <p className="text-sm font-medium">{c.nome_tribunal}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              {c.numero_oab && <span>OAB: {c.numero_oab}/{c.seccional_oab}</span>}
                              <span>Token: {c.token_acesso ? "••••••" + c.token_acesso.slice(-4) : "Não definido"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCred(c)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteCred(c.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">Guia de Configuração — Tribunais e IA</h3>
                </div>

                {/* DataJud */}
                <div className="mb-5 rounded-lg border p-4 bg-muted/20">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">API DataJud / CNJ — Consulta Pública</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    A API DataJud do CNJ é pública e gratuita. Permite consultar processos de <strong>todos os tribunais do Brasil</strong>:
                    STF, STJ, TST, STM, TSE, TRFs (1–6), todos os 26 TJs estaduais, 24 TRTs e sistemas especiais como SEEU e Projudi.
                  </p>
                  <div className="space-y-1 text-xs">
                    <p><span className="font-medium text-foreground">Endpoint base:</span> <code className="bg-muted px-1 rounded">https://api-publica.datajud.cnj.jus.br</code></p>
                    <p><span className="font-medium text-foreground">Autenticação:</span> credencial pública do CNJ protegida nas Edge Functions.</p>
                    <p><span className="font-medium text-foreground">Índice TJAM:</span> <code className="bg-muted px-1 rounded">api_publica_tjam</code> | SEEU e Projudi: consultados pelo índice do tribunal identificado no número CNJ.</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">A credencial é atualizada no Supabase e nunca é exposta no navegador. Nenhuma ação do escritório é necessária para consulta básica.</p>
                </div>

                {/* SEEU */}
                <div className="mb-5 rounded-lg border border-blue-500/20 p-4 bg-blue-500/5">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">SEEU — Sistema Eletrônico de Execução Unificado</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    O SEEU gerencia execuções penais em <strong>35+ estabelecimentos</strong>. A consulta é feita via DataJud (índice <code className="bg-muted px-1 rounded text-[10px]">api_seeu</code>).
                    Para acesso avançado com peticionamento, configure:
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>1. Acesse o portal SEEU e gere um token de acesso vinculado ao seu CPF/OAB.</p>
                    <p>2. Cadastre-o acima em <strong>Credenciais → SEEU</strong> com número OAB e seccional AM.</p>
                    <p>3. Após cadastro, o botão "Peticionar" ficará habilitado para processos SEEU.</p>
                  </div>
                </div>

                {/* Projudi */}
                <div className="mb-5 rounded-lg border border-purple-500/20 p-4 bg-purple-500/5">
                  <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2">Projudi — Processo Judicial Digital</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    O Projudi é usado pelo <strong>TJAM</strong>, TJPR, TJRR, TJRO e outros TJs. A consulta pública é feita via DataJud.
                    Para peticionamento eletrônico no Projudi TJAM:
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>1. Acesse <span className="italic">projudi.tjam.jus.br</span> e faça login com certificado digital A1/A3.</p>
                    <p>2. Gere um token de sessão ou use as credenciais OAB/CPF do sistema.</p>
                    <p>3. Cadastre-o acima em <strong>Credenciais → Projudi</strong>.</p>
                    <p>4. Para outros TJs com Projudi, repita o processo com o índice correto de cada tribunal.</p>
                  </div>
                </div>

                {/* PJe */}
                <div className="mb-5 rounded-lg border p-4 bg-muted/20">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">PJe — Processo Judicial Eletrônico (CNJ)</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    O PJe é o sistema padrão de peticionamento do CNJ, usado pela maioria dos tribunais federais, TRTs e vários TJs.
                    A integração usa o protocolo <strong>MNI (Message Negotiation Interface)</strong>.
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>1. Instale o software PJe ou acesse via navegador com certificado A1/A3.</p>
                    <p>2. Obtenha o token JWT no portal do tribunal (ex: <span className="italic">pje.tjam.jus.br</span>, <span className="italic">pje.trf1.jus.br</span>).</p>
                    <p>3. Cadastre o token em <strong>Credenciais → [Tribunal correspondente]</strong>.</p>
                    <p>4. O sistema usará esse token para peticionamento via API MNI do PJe.</p>
                  </div>
                </div>

                {/* Horus IA para tribunais */}
                <div className="mb-4 rounded-lg border border-primary/20 p-4 bg-primary/5">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Horus IA — Consulta com Contexto Processual</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Para que o Horus consulte e analise processos de tribunais específicos, primeiro faça a busca em
                    <strong> Busca Processual</strong>, depois cole o resultado ou número do processo no chat do Horus.
                    O assistente pode analisar movimentações, sugerir estratégias e gerar peças com base no processo real.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Tribunais com melhor cobertura via DataJud:</strong> TJAM, STJ, STF, TRF1, TST, TJSP, TJRJ, TJMG — e todos os demais 85+ tribunais indexados pelo CNJ.
                  </p>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "API DataJud (CNJ)", ok: true },
                    { label: "SEEU via DataJud", ok: true },
                    { label: "Projudi via DataJud", ok: true },
                    { label: "26 TJs Estaduais", ok: true },
                    { label: "24 TRTs", ok: true },
                    { label: "TRFs 1-6", ok: true },
                    { label: "STF / STJ / TST / STM / TSE", ok: true },
                    { label: "Horus IA (Gemini)", ok: true },
                    { label: "PJe / MNI (token necessário)", ok: false },
                    { label: "Projudi AM (token necessário)", ok: false },
                    { label: "SEEU Peticionamento (token necessário)", ok: false },
                  ].map((item) => (
                    <span
                      key={item.label}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        item.ok
                          ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border border-[hsl(var(--success))]/20"
                          : "bg-muted text-muted-foreground border"
                      }`}
                    >
                      {item.ok ? "✓ " : ""}{item.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === INTEGRAÇÕES === */}
          <TabsContent value="integracoes" className="space-y-4">

            {/* ── Plano / Asaas ── */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold font-serif">Plano & Assinatura</h3>
                  {planData?.status === "trial" && (
                    <span className="ml-auto text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Trial — {Math.max(0, trialDaysLeft)} dias restantes
                    </span>
                  )}
                  {planData?.status === "active" && (
                    <span className="ml-auto text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Ativo — {PLANS[planData?.plan as keyof typeof PLANS]?.name || planData?.plan}
                    </span>
                  )}
                </div>

                {/* Current plan indicator */}
                {planData?.status === "trial" && (
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 mb-5">
                    <p className="text-sm font-semibold text-yellow-700 mb-1">Você está no período de teste gratuito</p>
                    <p className="text-xs text-muted-foreground">Escolha um plano abaixo para continuar usando o LEXIA após o trial. O pagamento é feito via PIX ou cartão de crédito.</p>
                  </div>
                )}

                {/* Plans */}
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
                  {(Object.entries(PLANS) as [string, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => (
                    <div key={key} className={`rounded-xl border p-4 relative transition-all hover:shadow-md ${"popular" in plan && plan.popular ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                      {"popular" in plan && plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
                          MAIS VENDIDO
                        </div>
                      )}
                      <p className="font-serif font-bold text-sm">{plan.name}</p>
                      <p className="text-2xl font-bold mt-1">R$ {plan.price}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.slice(0, 3).map(f => (
                          <li key={f} className="flex items-start gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" /> {f}
                          </li>
                        ))}
                        {plan.features.length > 3 && <li className="text-xs text-muted-foreground">+{plan.features.length - 3} mais...</li>}
                      </ul>
                      <Button
                        size="sm"
                        className="w-full mt-3 gap-1.5"
                        variant={("popular" in plan && plan.popular) ? "default" : "outline"}
                        onClick={() => navigate(`/checkout?plan=${key}`)}
                        disabled={planData?.plan === key && planData?.status === "active"}
                      >
                        {planData?.plan === key && planData?.status === "active" ? "Plano atual" : "Ver contratação"}
                        {!(planData?.plan === key && planData?.status === "active") && <ArrowRight className="w-3 h-3" />}
                      </Button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  No checkout você pode comparar mensal e anual, adicionar usuários,
                  monitoramentos, créditos de IA e contratar white-label nos planos elegíveis.
                </p>
              </CardContent>
            </Card>

            {/* ── Google Calendar ── */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke={gcalConnected ? "#22c55e" : "currentColor"} strokeWidth="2" fill="none"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke={gcalConnected ? "#22c55e" : "currentColor"} strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="2" fill={gcalConnected ? "#22c55e" : "currentColor"}/>
                  </svg>
                  <h3 className="font-semibold font-serif">Google Calendar</h3>
                  {gcalConnected
                    ? <span className="ml-auto text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Conectado</span>
                    : <span className="ml-auto text-xs text-muted-foreground">Não conectado</span>
                  }
                </div>

                {gcalConnected ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                      <p className="text-sm font-medium text-green-700 mb-1">Integração ativa</p>
                      <p className="text-xs text-muted-foreground">
                        {gcalStatus?.connection?.google_email
                          ? `Conta: ${gcalStatus.connection.google_email}`
                          : "Sua conta Google está conectada."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Novos compromissos serão sincronizados automaticamente.
                      </p>
                      {gcalStatus?.connection?.last_sync_at ? (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Última sincronização: {new Date(gcalStatus.connection.last_sync_at).toLocaleString("pt-BR")}
                        </p>
                      ) : null}
                      {(gcalStatus?.queue.pending || gcalStatus?.queue.retry || gcalStatus?.queue.failed) ? (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Pendentes: {(gcalStatus?.queue.pending ?? 0) + (gcalStatus?.queue.retry ?? 0)}
                          {gcalStatus?.queue.failed ? ` · Com erro: ${gcalStatus.queue.failed}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleGcalSync}
                        disabled={gcalLoading}
                      >
                        {gcalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        Sincronizar agora
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => setShowGcalDisconnectDialog(true)}
                        disabled={gcalLoading}
                      >
                        <Link2Off className="w-4 h-4" /> Desconectar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gcalStatus?.connection?.status === "reconnect_required" ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                        <p className="text-sm font-medium text-amber-700">Reconexão necessária</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          O Google revogou ou expirou a autorização. Conecte novamente.
                        </p>
                      </div>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      Conecte sua conta Google para sincronizar compromissos, audiências e prazos diretamente no seu calendário.
                    </p>
                    <div className="rounded-lg border p-3 bg-muted/30 text-xs space-y-1">
                      <p className="font-semibold text-foreground">Como funciona:</p>
                      <p className="text-muted-foreground">1. Clique em "Conectar Google" abaixo</p>
                      <p className="text-muted-foreground">2. Autorize o ADVeyes no Google</p>
                      <p className="text-muted-foreground">3. Novos eventos serão sincronizados automaticamente</p>
                    </div>
                    <Button
                      className="gap-2 w-full sm:w-auto"
                      onClick={handleGcalConnect}
                      disabled={gcalLoading}
                    >
                      {gcalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      {gcalStatus?.connection?.status === "reconnect_required"
                        ? "Reconectar Google Calendar"
                        : "Conectar Google Calendar"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                      O acesso é individual e pode ser revogado a qualquer momento.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <AlertDialog
              open={showGcalDisconnectDialog}
              onOpenChange={setShowGcalDisconnectDialog}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desconectar Google Calendar</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os dados continuarão no ADVeyes. Escolha se os eventos já
                    criados também devem ser removidos da sua agenda Google.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-between">
                  <AlertDialogCancel disabled={gcalLoading}>Cancelar</AlertDialogCancel>
                  <div className="flex flex-col-reverse sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleGcalDisconnect(false)}
                      disabled={gcalLoading}
                    >
                      Manter eventos no Google
                    </Button>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        void handleGcalDisconnect(true);
                      }}
                      disabled={gcalLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover eventos e desconectar
                    </AlertDialogAction>
                  </div>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* ── JusBrasil ── */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">JusBrasil API</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure como secret no Supabase → Edge Functions → Secrets:
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                  <p className="text-primary font-semibold">JUSBRASIL_API_KEY</p>
                  <p className="text-muted-foreground text-xs mt-1">Obtenha em api.jusbrasil.com.br</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === NOTIFICAÇÕES === */}
          <TabsContent value="notificacoes" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Bell className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold font-serif">Notificações</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Notificações por e-mail", desc: "Receba alertas por e-mail", checked: false },
                    { label: "Alertas de prazos", desc: "Avisos antes do vencimento", checked: true },
                    { label: "Novas publicações", desc: "DJe e publicações oficiais", checked: true },
                    { label: "Movimentações processuais", desc: "Mudanças nos processos monitorados", checked: true },
                    { label: "Audiências próximas", desc: "Lembrete 24h antes", checked: true },
                    { label: "Vencimentos financeiros", desc: "Honorários e despesas", checked: true },
                  ].map((n) => (
                    <div key={n.label} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <Label className="text-sm font-medium">{n.label}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                      </div>
                      <Switch defaultChecked={n.checked} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Credential Form Dialog */}
        <Dialog open={showCredForm} onOpenChange={setShowCredForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editCred ? "Editar Credencial" : "Nova Credencial de Tribunal"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCredSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tribunal / Sistema *</Label>
                <Select value={credForm.tribunal} onValueChange={(v) => setCredForm({ ...credForm, tribunal: v })} disabled={!!editCred}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tribunal ou sistema" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {tribunaisDisponiveis.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número OAB</Label>
                  <Input value={credForm.numero_oab} onChange={(e) => setCredForm({ ...credForm, numero_oab: e.target.value })} placeholder="12345" />
                </div>
                <div className="space-y-2">
                  <Label>Seccional</Label>
                  <Input value={credForm.seccional_oab} onChange={(e) => setCredForm({ ...credForm, seccional_oab: e.target.value })} placeholder="AM" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={credForm.cpf} onChange={(e) => setCredForm({ ...credForm, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Token de Acesso / API Key
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Opcional</span>
                </Label>
                <Input type="password" value={credForm.token_acesso} onChange={(e) => setCredForm({ ...credForm, token_acesso: e.target.value })} placeholder="Cole aqui o token do tribunal (opcional)" />
                <p className="text-xs text-muted-foreground">
                  Token JWT para peticionamento eletrônico (PJe, SEEU, Projudi). Deixe em branco se quiser apenas monitorar publicações via DataJud/CNJ — isso funciona só com OAB ou CPF.
                </p>
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
