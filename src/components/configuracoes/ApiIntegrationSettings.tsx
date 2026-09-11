import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Loader2, Plus, RefreshCw, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  publicApiAdmin,
  type PublicApiAdminState,
} from "@/services/public-api-admin";

const SCOPE_LABELS: Record<string, string> = {
  "contacts:read": "Ler contatos",
  "contacts:write": "Gravar contatos",
  "processes:read": "Ler processos",
  "processes:write": "Gravar processos",
  "tasks:read": "Ler tarefas",
  "tasks:write": "Gravar tarefas",
  "webhooks:manage": "Gerenciar webhooks",
};

interface Props {
  tenantId: string;
  canManage: boolean;
}

export function ApiIntegrationSettings({ tenantId, canManage }: Props) {
  const { toast } = useToast();
  const [state, setState] = useState<PublicApiAdminState | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "contacts:read", "processes:read", "tasks:read",
  ]);
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["*"]);
  const [revealed, setRevealed] = useState<{ title: string; value: string } | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      setState(await publicApiAdmin.list(tenantId));
    } catch (error) {
      toast({
        title: "Não foi possível carregar a API",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, tenantId, toast]);

  useEffect(() => { void load(); }, [load]);

  const activeTokens = useMemo(
    () => state?.tokens.filter((token) => !token.revoked_at) ?? [],
    [state],
  );

  const copySecret = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.value);
    toast({ title: "Copiado para a área de transferência" });
  };

  const createToken = async () => {
    if (!tokenName.trim() || selectedScopes.length === 0) return;
    setWorking(true);
    try {
      const result = await publicApiAdmin.createToken(tenantId, {
        name: tokenName.trim(),
        scopes: selectedScopes,
        expiresInDays: Number(expiresInDays),
      });
      setRevealed({ title: "Token criado — copie agora", value: result.token });
      setTokenName("");
      await load();
      toast({ title: "Credencial criada" });
    } catch (error) {
      toast({ title: "Erro ao criar credencial", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    setWorking(true);
    try {
      await publicApiAdmin.revokeToken(tenantId, tokenId);
      await load();
      toast({ title: "Credencial revogada" });
    } catch (error) {
      toast({ title: "Erro ao revogar", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const createWebhook = async () => {
    if (!webhookName.trim() || !webhookUrl.trim() || selectedEvents.length === 0) return;
    setWorking(true);
    try {
      const result = await publicApiAdmin.createWebhook(tenantId, {
        name: webhookName.trim(), url: webhookUrl.trim(), eventTypes: selectedEvents,
      });
      setRevealed({ title: "Segredo do webhook — copie agora", value: result.secret });
      setWebhookName("");
      setWebhookUrl("");
      await load();
      toast({ title: "Webhook criado" });
    } catch (error) {
      toast({ title: "Erro ao criar webhook", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Apenas proprietários e administradores podem gerenciar credenciais e webhooks.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> API pública v1</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Integração server-to-server isolada por escritório.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/docs/" target="_blank" rel="noreferrer">Documentação <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Atualizar credenciais">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {revealed ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-sm font-semibold text-amber-700">{revealed.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">Este valor não será exibido novamente.</p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={revealed.value} className="font-mono text-xs" aria-label={revealed.title} />
                <Button size="icon" variant="outline" onClick={() => void copySecret()} aria-label="Copiar segredo"><Copy className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}><Check className="mr-1 h-4 w-4" /> Já salvei</Button>
              </div>
            </div>
          ) : null}

          {state?.providers ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fontes jurídicas</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(state.providers).map(([provider, configured]) => (
                  <Badge key={provider} variant={configured ? "default" : "outline"}>
                    {provider.toUpperCase()} · {configured ? "ativo" : "não configurado"}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">DataJud e DJEN são priorizados; JUDIT, TrackJud e Escavador entram como complementos pagos nessa ordem. Conecta permanece bloqueado sem autorização institucional.</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
            <div><Label htmlFor="api-token-name">Nome da credencial</Label><Input id="api-token-name" value={tokenName} onChange={(event) => setTokenName(event.target.value)} placeholder="ERP do escritório" /></div>
            <div><Label htmlFor="api-token-expiry">Validade (dias)</Label><Input id="api-token-expiry" type="number" min="1" max="365" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} /></div>
            <Button className="self-end" onClick={() => void createToken()} disabled={working || !tokenName.trim() || selectedScopes.length === 0}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Criar token</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(state?.availableScopes ?? Object.keys(SCOPE_LABELS)).map((scope) => (
              <label key={scope} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                <Checkbox checked={selectedScopes.includes(scope)} onCheckedChange={(checked) => setSelectedScopes((current) => checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope))} />
                {SCOPE_LABELS[scope] ?? scope}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            {activeTokens.length === 0 && !loading ? <p className="text-sm text-muted-foreground">Nenhuma credencial ativa.</p> : null}
            {activeTokens.map((token) => (
              <div key={token.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{token.name}</p><p className="truncate font-mono text-xs text-muted-foreground">{token.token_prefix}••••••••</p></div>
                <Badge variant="outline">expira {new Date(token.expires_at).toLocaleDateString("pt-BR")}</Badge>
                <Button size="sm" variant="destructive" disabled={working} onClick={() => void revokeToken(token.id)}>Revogar</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4" /> Webhooks assinados</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
            <div><Label htmlFor="webhook-name">Nome</Label><Input id="webhook-name" value={webhookName} onChange={(event) => setWebhookName(event.target.value)} placeholder="Meu ERP" /></div>
            <div><Label htmlFor="webhook-url">URL HTTPS</Label><Input id="webhook-url" type="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://erp.exemplo.com/webhooks/adveyes" /></div>
            <Button className="self-end" onClick={() => void createWebhook()} disabled={working || !webhookName.trim() || !webhookUrl.trim()}><Plus className="mr-2 h-4 w-4" /> Criar webhook</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(state?.availableEvents ?? ["*"]).map((eventName) => (
              <button key={eventName} type="button" onClick={() => setSelectedEvents((current) => eventName === "*" ? ["*"] : current.includes(eventName) ? current.filter((item) => item !== eventName) : [...current.filter((item) => item !== "*"), eventName])} className={`rounded-full border px-2.5 py-1 text-xs ${selectedEvents.includes(eventName) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{eventName === "*" ? "Todos os eventos" : eventName}</button>
            ))}
          </div>
          {(state?.webhooks ?? []).map((endpoint) => (
            <div key={endpoint.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1"><p className="font-medium">{endpoint.name}</p><p className="truncate text-xs text-muted-foreground">{endpoint.url}</p></div>
              <Switch checked={endpoint.active} disabled={working} aria-label={`Ativar ${endpoint.name}`} onCheckedChange={async (active) => { setWorking(true); try { await publicApiAdmin.setWebhookActive(tenantId, endpoint.id, active); await load(); } finally { setWorking(false); } }} />
              <Badge variant={endpoint.active ? "default" : "secondary"}>{endpoint.active ? "Ativo" : "Pausado"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
