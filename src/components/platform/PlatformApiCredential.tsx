import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Globe2, Loader2, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DepthCard } from "@/components/dashboard/DepthCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { platformAdmin, type PlatformTokenList } from "@/services/platform-admin";

const SCOPE_LABELS: Record<string, string> = {
  "contacts:read": "Ler contatos",
  "contacts:write": "Gravar contatos",
  "processes:read": "Ler processos",
  "processes:write": "Gravar processos",
  "tasks:read": "Ler tarefas",
  "tasks:write": "Gravar tarefas",
  "webhooks:manage": "Gerenciar webhooks",
};

const DEFAULT_SCOPES = ["contacts:read", "processes:read", "tasks:read"];

export const PlatformApiCredential = () => {
  const { toast } = useToast();
  const [state, setState] = useState<PlatformTokenList | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES);
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await platformAdmin.listPlatformTokens());
    } catch (error) {
      toast({
        title: "Não foi possível carregar as credenciais de plataforma",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const activeTokens = useMemo(
    () => state?.tokens.filter((token) => !token.revoked_at) ?? [],
    [state],
  );

  const toggleScope = (scope: string) => {
    setScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  };

  const create = async () => {
    if (name.trim().length < 2 || scopes.length === 0) return;
    setWorking(true);
    try {
      const result = await platformAdmin.createPlatformToken({
        name: name.trim(),
        scopes,
        expiresInDays: Number(expiresInDays),
      });
      setRevealed(result.token);
      setName("");
      await load();
      toast({ title: "Credencial de plataforma criada" });
    } catch (error) {
      toast({
        title: "Erro ao criar credencial",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const revoke = async (tokenId: string) => {
    setWorking(true);
    try {
      await platformAdmin.revokePlatformToken(tokenId);
      await load();
      toast({ title: "Credencial revogada" });
    } catch (error) {
      toast({
        title: "Erro ao revogar",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const availableScopes = state?.availableScopes ?? Object.keys(SCOPE_LABELS);

  return (
    <DepthCard>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            Credencial de plataforma
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma única credencial alcança todos os escritórios, inclusive os que
            forem criados depois. Cada requisição escolhe o escritório pelo
            cabeçalho <code className="rounded bg-muted px-1">X-Tenant-Id</code>,
            e <code className="rounded bg-muted px-1">GET /api/v1/tenants</code>{" "}
            lista quais existem.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {revealed ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Credencial criada — copie agora
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Este valor não será exibido novamente.
            </p>
            <div className="mt-3 flex gap-2">
              <Input readOnly value={revealed} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  await navigator.clipboard.writeText(revealed);
                  toast({ title: "Copiado para a área de transferência" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => setRevealed(null)}>
                <Check className="mr-2 h-4 w-4" />
                Já salvei
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="platform-token-name">Nome da credencial</Label>
            <Input
              id="platform-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Automatikus"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-token-validity">Validade (dias)</Label>
            <Input
              id="platform-token-validity"
              className="w-28"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
            />
          </div>
          <Button onClick={() => void create()} disabled={working || name.trim().length < 2}>
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Criar credencial
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {availableScopes.map((scope) => (
            <label
              key={scope}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={scopes.includes(scope)}
                onCheckedChange={() => toggleScope(scope)}
              />
              {SCOPE_LABELS[scope] ?? scope}
            </label>
          ))}
        </div>

        {activeTokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando…" : "Nenhuma credencial de plataforma ativa."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {activeTokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="font-medium">{token.name}</span>
                <code className="rounded bg-muted px-1 text-xs">{token.token_prefix}…</code>
                <Badge variant="secondary">{token.scopes.length} permissões</Badge>
                <span className="text-xs text-muted-foreground">
                  expira em {new Date(token.expires_at).toLocaleDateString("pt-BR")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={working}
                  onClick={() => void revoke(token.id)}
                >
                  Revogar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </DepthCard>
  );
};

export default PlatformApiCredential;
