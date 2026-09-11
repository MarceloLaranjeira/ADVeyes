import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePlatformSupport } from "@/contexts/PlatformSupportContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { whatsappMeta, type WhatsAppAdminState, type WhatsAppTemplate } from "@/services/whatsapp-meta";
import { CheckCheck, ExternalLink, Link2, Loader2, MessageSquare, Phone, RefreshCw, Send, ShieldCheck, Unplug, UserRound } from "lucide-react";

type MetaLoginResponse = { authResponse?: { code?: string } };
type MetaSdk = {
  init: (input: Record<string, unknown>) => void;
  login: (callback: (response: MetaLoginResponse) => void, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: MetaSdk;
    fbAsyncInit?: () => void;
  }
}

const META_SDK_ID = "meta-facebook-jssdk";
const META_SDK_TIMEOUT_MS = 15_000;
const META_LOGIN_TIMEOUT_MS = 120_000;
let metaSdkPromise: Promise<MetaSdk> | null = null;

function loadMetaSdk(): Promise<MetaSdk> {
  if (window.FB) return Promise.resolve(window.FB);
  if (metaSdkPromise) return metaSdkPromise;

  metaSdkPromise = new Promise<MetaSdk>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      if (!window.FB) {
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error("meta_sdk_unavailable"));
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      resolve(window.FB);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(new Error("meta_sdk_unavailable"));
    };
    const timeout = window.setTimeout(fail, META_SDK_TIMEOUT_MS);
    const previousAsyncInit = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      previousAsyncInit?.();
      finish();
    };

    const existing = document.getElementById(META_SDK_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      window.setTimeout(() => { if (window.FB) finish(); }, 0);
      return;
    }

    const script = document.createElement("script");
    script.id = META_SDK_ID;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.body.appendChild(script);
  }).catch((error) => {
    metaSdkPromise = null;
    document.getElementById(META_SDK_ID)?.remove();
    throw error;
  });

  return metaSdkPromise;
}

function metaErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "meta_sdk_unavailable") {
    return "O SDK da Meta foi bloqueado ou não carregou. Desative o bloqueador para connect.facebook.net e tente novamente.";
  }
  if (code === "meta_login_timeout") {
    return "A janela da Meta não respondeu. Verifique se o navegador bloqueou o pop-up e tente novamente.";
  }
  return error instanceof Error ? error.message : "Tente novamente.";
}

type Conversation = { id: string; client_id: string | null; contact_phone: string; contact_name: string | null; last_message_at: string; last_message_preview: string | null; unread_count: number };
type WhatsAppMessage = { id: string; direction: "inbound" | "outbound"; body_text: string | null; status: string; occurred_at: string };
type Client = { id: string; nome: string; telefone: string | null };

function formatDate(value: string) { return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function statusLabel(status: string) { return ({ connected: "Conectado", connecting: "Conectando", reconnect_required: "Reconectar", revoked: "Desconectado", error: "Com erro" } as Record<string, string>)[status] ?? status; }

export default function WhatsApp() {
  const { currentTenant } = useTenant();
  const support = usePlatformSupport();
  const { toast } = useToast();
  const tenantId = currentTenant?.tenantId ?? null;
  const embedded = useRef<{ wabaId: string | null; phoneNumberId: string | null }>({ wabaId: null, phoneNumberId: null });
  const [state, setState] = useState<WhatsAppAdminState | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [sdkStatus, setSdkStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [recipient, setRecipient] = useState("");
  const [clientId, setClientId] = useState("");
  const [text, setText] = useState("");
  const [templateKey, setTemplateKey] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [adminState, conversationsResult, clientsResult] = await Promise.all([
        whatsappMeta.status(tenantId),
        // As tabelas nascem na migration desta entrega; o arquivo gerado de
        // tipos só será atualizado depois que ela alcançar o projeto remoto.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("whatsapp_conversations").select("id,client_id,contact_phone,contact_name,last_message_at,last_message_preview,unread_count").eq("tenant_id", tenantId).order("last_message_at", { ascending: false }),
        supabase.from("clientes").select("id,nome,telefone").eq("tenant_id", tenantId).order("nome"),
      ]);
      setState(adminState);
      setConversations((conversationsResult.data ?? []) as Conversation[]);
      setClients((clientsResult.data ?? []) as Client[]);
    } catch (error) {
      toast({ title: "Não foi possível carregar o WhatsApp", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setLoading(false); }
  }, [tenantId, toast]);

  const loadMessages = useCallback(async (conversationId: string | null) => {
    if (!conversationId) { setMessages([]); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("whatsapp_messages").select("id,direction,body_text,status,occurred_at").eq("conversation_id", conversationId).order("occurred_at");
    if (error) { toast({ title: "Não foi possível abrir a conversa", variant: "destructive" }); return; }
    setMessages((data ?? []) as WhatsAppMessage[]);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMessages(selectedConversation); }, [loadMessages, selectedConversation]);
  useEffect(() => {
    if (!state?.canManage || !state.embeddedSignup.appId || !state.embeddedSignup.configurationId) return;
    let cancelled = false;
    setSdkStatus("loading");
    void loadMetaSdk().then((sdk) => {
      sdk.init({ appId: state.embeddedSignup.appId, cookie: true, xfbml: false, version: "v23.0" });
      if (!cancelled) setSdkStatus("ready");
    }).catch(() => { if (!cancelled) setSdkStatus("error"); });
    return () => { cancelled = true; };
  }, [state?.canManage, state?.embeddedSignup.appId, state?.embeddedSignup.configurationId]);
  useEffect(() => {
    if (!tenantId || state?.connection?.status !== "connected" || !state.canManage) { setTemplates([]); return; }
    void whatsappMeta.templates(tenantId).then((result) => setTemplates(result.templates)).catch(() => setTemplates([]));
  }, [state?.canManage, state?.connection?.status, tenantId]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const hostname = (() => { try { return new URL(event.origin).hostname; } catch { return ""; } })();
      if ((hostname !== "facebook.com" && !hostname.endsWith(".facebook.com")) || typeof event.data !== "string") return;
      try {
        const payload = JSON.parse(event.data) as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
        if (payload.type === "WA_EMBEDDED_SIGNUP" && payload.event === "FINISH") {
          embedded.current = { wabaId: payload.data?.waba_id ?? null, phoneNumberId: payload.data?.phone_number_id ?? null };
        }
      } catch { /* mensagens de outras integrações são ignoradas */ }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const connect = async () => {
    if (!tenantId || !state?.canManage || !state.embeddedSignup.appId || !state.embeddedSignup.configurationId) {
      toast({ title: "Integração Meta pendente", description: "O administrador da plataforma ainda precisa configurar os segredos do servidor.", variant: "destructive" });
      return;
    }
    setWorking(true);
    try {
      setSdkStatus("loading");
      const sdk = await loadMetaSdk();
      sdk.init({ appId: state.embeddedSignup.appId, cookie: true, xfbml: false, version: "v23.0" });
      setSdkStatus("ready");
      const result = await new Promise<MetaLoginResponse>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("meta_login_timeout")), META_LOGIN_TIMEOUT_MS);
        try {
          sdk.login((response) => {
            window.clearTimeout(timeout);
            resolve(response);
          }, {
            config_id: state.embeddedSignup.configurationId,
            response_type: "code",
            override_default_response_type: true,
            extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
          });
        } catch (error) {
          window.clearTimeout(timeout);
          reject(error);
        }
      });
      const code = result.authResponse?.code;
      if (!code) {
        toast({ title: "Conexão cancelada", description: "A autorização da Meta não foi concluída." });
        return;
      }
      await whatsappMeta.completeEmbeddedSignup(tenantId, { code, ...embedded.current });
      toast({ title: "WhatsApp conectado", description: "O número do escritório já pode enviar e receber mensagens." });
      await load();
    } catch (error) {
      setSdkStatus("error");
      toast({ title: "Não foi possível abrir a Meta", description: metaErrorMessage(error), variant: "destructive" });
    } finally { setWorking(false); }
  };

  const disconnect = async () => {
    if (!tenantId) return;
    setWorking(true);
    try { await whatsappMeta.disconnect(tenantId); await load(); toast({ title: "WhatsApp desconectado" }); }
    catch (error) { toast({ title: "Não foi possível desconectar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setWorking(false); }
  };

  const send = async () => {
    if (!tenantId || !recipient.trim() || (!templateKey && !text.trim())) return;
    setWorking(true);
    try {
      const selectedTemplate = templates.find((item) => `${item.name}:${item.language}` === templateKey);
      if (selectedTemplate) {
        await whatsappMeta.sendTemplate(tenantId, { to: recipient, templateName: selectedTemplate.name, templateLanguage: selectedTemplate.language, clientId: clientId || null });
      } else {
        await whatsappMeta.sendText(tenantId, { to: recipient, text, clientId: clientId || null });
      }
      setText(""); setTemplateKey(""); await load(); await loadMessages(selectedConversation); toast({ title: "Mensagem enviada" });
    } catch (error) { toast({ title: "Não foi possível enviar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setWorking(false); }
  };

  const selectClient = (id: string) => { setClientId(id); const client = clients.find((item) => item.id === id); if (client?.telefone) setRecipient(client.telefone); };
  const readonly = currentTenant?.accessMode === "platform" && !support.active;
  const canManage = Boolean(state?.canManage && !readonly);
  const canSend = canManage && !working && Boolean(recipient.trim()) && Boolean(templateKey || text.trim());

  return <AppLayout><div className="space-y-5 animate-fade-in">
    <header className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-primary"><MessageSquare className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[.16em]">WhatsApp Business</span></div><h1 className="mt-1 font-serif text-3xl font-bold">Comunicação do escritório</h1><p className="mt-1 text-sm text-muted-foreground">Conexão oficial pela Meta, conversas e status de entrega em um só lugar.</p></div><div className="flex gap-2"><Button variant="outline" asChild><a href="/api/whatsapp-docs.html" target="_blank" rel="noreferrer">API <ExternalLink className="ml-2 h-4 w-4" /></a></Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button></div></div></header>
    {readonly && <Card className="border-sky-300 bg-sky-50"><CardContent className="flex gap-3 p-4 text-sm text-sky-950"><ShieldCheck className="h-5 w-5 shrink-0" />A Conta Geral está em visualização. Ative o suporte temporário para conectar, desconectar ou enviar mensagens.</CardContent></Card>}
    <Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-full bg-green-500/10 p-2 text-green-700"><Phone className="h-5 w-5" /></div><div><p className="font-semibold">{state?.connection?.verified_name ?? state?.connection?.business_name ?? "Nenhum WhatsApp conectado"}</p><p className="text-sm text-muted-foreground">{state?.connection ? `${state.connection.display_phone_number ?? state.connection.phone_number_id} · cobrança direta pela Meta` : "Conecte o WhatsApp Business do escritório pelo onboarding da Meta."}</p></div></div><div className="flex flex-wrap items-center gap-2">{state?.connection && <Badge variant={state.connection.status === "connected" ? "default" : "outline"}>{statusLabel(state.connection.status)}</Badge>}{state?.connection?.status === "connected" ? <Button variant="outline" disabled={!canManage || working} onClick={() => void disconnect()}><Unplug className="mr-2 h-4 w-4" />Desconectar</Button> : <Button disabled={!canManage || working || loading || sdkStatus === "loading"} onClick={() => void connect()}>{working || sdkStatus === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}{sdkStatus === "loading" && !working ? "Preparando Meta" : sdkStatus === "error" ? "Tentar carregar Meta" : "Conectar WhatsApp"}</Button>}</div></CardContent></Card>
    {state?.connection?.status === "connected" ? <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"><Card><CardHeader className="pb-2"><CardTitle className="text-base">Conversas</CardTitle></CardHeader><ScrollArea className="h-[520px]"><CardContent className="space-y-1 px-3 pb-3">{conversations.length === 0 ? <p className="p-3 text-sm text-muted-foreground">As novas mensagens recebidas aparecerão aqui.</p> : conversations.map((conversation) => <button key={conversation.id} onClick={() => { setSelectedConversation(conversation.id); setRecipient(conversation.contact_phone); setClientId(conversation.client_id ?? ""); }} className={`w-full rounded-lg p-3 text-left ${selectedConversation === conversation.id ? "bg-primary/10" : "hover:bg-muted"}`}><div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{conversation.contact_name ?? conversation.contact_phone}</span>{conversation.unread_count > 0 && <Badge>{conversation.unread_count}</Badge>}</div><p className="truncate text-xs text-muted-foreground">{conversation.last_message_preview ?? "Sem prévia"}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatDate(conversation.last_message_at)}</p></button>)}</CardContent></ScrollArea></Card><Card><CardHeader className="border-b pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" />{selectedConversation ? "Conversa" : "Nova mensagem"}</CardTitle></CardHeader><CardContent className="space-y-4 p-4"><ScrollArea className="h-[270px] rounded-lg bg-muted/30 p-3">{messages.length === 0 ? <p className="pt-20 text-center text-sm text-muted-foreground">Selecione uma conversa ou inicie uma nova mensagem.</p> : <div className="space-y-3">{messages.map((message) => <div key={message.id} className={message.direction === "outbound" ? "ml-auto max-w-[80%] rounded-xl bg-primary p-3 text-sm text-primary-foreground" : "mr-auto max-w-[80%] rounded-xl bg-card p-3 text-sm shadow-sm"}><p>{message.body_text ?? "Mensagem sem texto"}</p><p className="mt-1 flex items-center gap-1 text-[10px] opacity-75">{formatDate(message.occurred_at)} {message.direction === "outbound" && <><CheckCheck className="h-3 w-3" />{message.status}</>}</p></div>)}</div>}</ScrollArea><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="whatsapp-client">Contato cadastrado</Label><select id="whatsapp-client" value={clientId} onChange={(event) => selectClient(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Selecionar contato</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.nome}</option>)}</select></div><div><Label htmlFor="whatsapp-recipient">WhatsApp do destinatário</Label><Input id="whatsapp-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="5592..." /></div></div><div><Label htmlFor="whatsapp-template">Tipo de envio</Label><select id="whatsapp-template" value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Mensagem de sessão (janela de 24h)</option>{templates.map((template) => <option key={`${template.name}:${template.language}`} value={`${template.name}:${template.language}`}>{template.name} · {template.language}</option>)}</select></div>{templateKey ? <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">O template aprovado será enviado pela Meta. Templates com variáveis devem ser parametrizados pela API.</p> : <div><Label htmlFor="whatsapp-text">Mensagem</Label><Textarea id="whatsapp-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma mensagem para o cliente" className="mt-1 min-h-28" maxLength={4096} /></div>}<div className="flex justify-end"><Button onClick={() => void send()} disabled={!canSend}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar pela Meta</Button></div></CardContent></Card></div> : <Card><CardContent className="p-10 text-center"><MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">Conecte o WhatsApp Business do escritório</h2><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">O administrador conclui o Embedded Signup da Meta. A cobrança, o método de pagamento e a fatura permanecem diretamente com a Meta.</p></CardContent></Card>}
  </div></AppLayout>;
}
