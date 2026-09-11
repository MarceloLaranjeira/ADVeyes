import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AccessLinkState } from "@/types/access-requests";

interface Props {
  open: boolean;
  link: AccessLinkState;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: () => Promise<void>;
  onRevoke: () => Promise<void>;
}

/**
 * Link privado do escritório.
 *
 * O token em claro só existe no instante da geração — o banco guarda apenas o
 * hash. Por isso a URL aparece uma única vez e precisa ser copiada agora.
 */
export function AccessLinkPanel({
  open,
  link,
  busy,
  onOpenChange,
  onGenerate,
  onRevoke,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!link.url) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link de solicitação de acesso</DialogTitle>
          <DialogDescription>
            Quem abrir este link entra com a própria conta e pede acesso. Nada é
            liberado até você aprovar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {link.url
            ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <code className="min-w-0 flex-1 truncate text-xs">
                    {link.url}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    onClick={() => void copy()}
                  >
                    {copied
                      ? <Check className="h-3.5 w-3.5" />
                      : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Copie agora: por segurança, o endereço completo não pode ser
                  exibido de novo. Gerar outro link revoga este.
                </p>
              </div>
            )
            : (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {link.exists
                  ? "Existe um link ativo, mas o endereço não pode ser recuperado. Gere outro para compartilhar novamente."
                  : "Este escritório ainda não tem um link de solicitação."}
              </p>
            )}

          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              disabled={busy}
              onClick={() => void onGenerate()}
            >
              <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {link.exists ? "Gerar novo link" : "Gerar link"}
            </Button>
            {link.exists && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void onRevoke()}
              >
                Revogar link
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
