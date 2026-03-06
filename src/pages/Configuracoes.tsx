import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  User, Bell, Shield, Palette, Moon, Sun, Plus, Pencil, Trash2,
  Key, CheckCircle, XCircle, Volume2, Mic, Zap, Bot, RefreshCw,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [credenciais, setCredenciais] = useState<any[]>([]);
  const [showCredForm, setShowCredForm] = useState(false);
  const [editCred, setEditCred] = useState<any>(null);
  const [deleteCred, setDeleteCred] = useState<string | null>(null);
  const [credForm, setCredForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  // TTS Settings (persisted in localStorage)
  const [ttsProvider, setTtsProvider] = useState(() => localStorage.getItem("horus_tts_provider") || "browser");
  const [ttsApiKey, setTtsApiKey] = useState(() => localStorage.getItem("horus_tts_key") || "");
  const [ttsVoice, setTtsVoice] = useState(() => localStorage.getItem("horus_tts_voice") || "nova");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState(() => localStorage.getItem("horus_11labs_voice") || "21m00Tcm4TlvDq8ikWAM");
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem("horus_tts_enabled") !== "false");

  const saveTtsSettings = () => {
    localStorage.setItem("horus_tts_provider", ttsProvider);
    localStorage.setItem("horus_tts_key", ttsApiKey);
    localStorage.setItem("horus_tts_voice", ttsVoice);
    localStorage.setItem("horus_11labs_voice", elevenLabsVoiceId);
    localStorage.setItem("horus_tts_enabled", String(ttsEnabled));
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
          <TabsList className="mb-6 bg-muted/50">
            <TabsTrigger value="geral" className="gap-2"><Palette className="w-3.5 h-3.5" /> Geral</TabsTrigger>
            <TabsTrigger value="voz" className="gap-2"><Volume2 className="w-3.5 h-3.5" /> Voz & IA</TabsTrigger>
            <TabsTrigger value="tribunais" className="gap-2"><Key className="w-3.5 h-3.5" /> Tribunais</TabsTrigger>
            <TabsTrigger value="notificacoes" className="gap-2"><Bell className="w-3.5 h-3.5" /> Notificações</TabsTrigger>
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
                  <h3 className="font-semibold font-serif">Perfil</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Usuário logado: <span className="font-medium text-foreground">{user?.email}</span></p>
                <p className="text-xs text-muted-foreground">Gerencie suas informações de perfil e dados do escritório nas configurações da conta.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === VOZ & IA === */}
          <TabsContent value="voz" className="space-y-4">
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
                    <p><span className="font-medium text-foreground">Autenticação:</span> API Key pública — <code className="bg-muted px-1 rounded">APIKey cDZHYzlZa0JadVREZDJCendFbzV3cU1qM2owQUlTSmFRdnBEstF</code></p>
                    <p><span className="font-medium text-foreground">Índice TJAM:</span> <code className="bg-muted px-1 rounded">api_tjam</code> | Índice SEEU: <code className="bg-muted px-1 rounded">api_seeu</code> | Projudi: consultado via TJs parceiros</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Essa chave já está configurada na Edge Function busca-processual. Nenhuma ação necessária para consulta básica.</p>
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
                <Label>Token de Acesso / API Key</Label>
                <Input type="password" value={credForm.token_acesso} onChange={(e) => setCredForm({ ...credForm, token_acesso: e.target.value })} placeholder="Cole aqui o token do tribunal" />
                <p className="text-xs text-muted-foreground">Token JWT ou API Key do tribunal, SEEU ou Projudi.</p>
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
