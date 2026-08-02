import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformSupport } from "@/contexts/PlatformSupportContext";
import { useTenant } from "@/contexts/TenantContext";
import { Eye, Loader2, ShieldAlert } from "lucide-react";

export function PlatformSupportBanner() {
  const { currentTenant } = useTenant();
  const support = usePlatformSupport();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!support.isPlatformAccess || !currentTenant) return null;

  const activate = async () => {
    await support.start(reason.trim());
    setReason("");
    setOpen(false);
  };

  return (
    <>
      <div className={`sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm ${
        support.active
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-sky-200 bg-sky-50 text-sky-950"
      }`}>
        <div className="flex items-center gap-2">
          {support.active
            ? <ShieldAlert className="h-4 w-4" />
            : <Eye className="h-4 w-4" />}
          <span>
            <strong>Conta Geral:</strong> {support.active
              ? `suporte temporário ativo em ${currentTenant.displayName}`
              : `visualização somente leitura de ${currentTenant.displayName}`}
          </span>
        </div>
        {support.active ? (
          <Button size="sm" variant="outline" onClick={() => void support.end()}>
            Encerrar suporte
          </Button>
        ) : (
          <Button size="sm" onClick={() => setOpen(true)}>
            Ativar suporte por 30 minutos
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar modo de suporte</DialogTitle>
            <DialogDescription>
              Informe o motivo. A abertura, o prazo e as alterações ficam
              vinculados à sua conta no histórico do escritório.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="support-reason">Motivo do atendimento</Label>
            <Textarea
              id="support-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: cliente solicitou ajuda para configurar a identidade visual"
              minLength={10}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={reason.trim().length < 10 || support.loading}
              onClick={() => void activate()}
            >
              {support.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ativar suporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
