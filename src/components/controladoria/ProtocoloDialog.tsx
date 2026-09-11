import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { attachProtocolDocuments, registerProtocol } from "@/services/controladoria-actions";
import { PROTOCOL_TYPES, type ProtocoloTipo } from "@/types/controladoria";

/** Prazo de origem: protocolar a peça é o que encerra este prazo. */
export interface ProtocoloOrigin {
  taskId: string;
  taskTitle: string;
  processId: string | null;
  processNumber: string | null;
}

export interface ProtocoloDialogProps {
  open: boolean;
  tenantId: string;
  userId: string;
  origin: ProtocoloOrigin | null;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void | Promise<void>;
}

interface FormState {
  tipo: ProtocoloTipo | "";
  protocoladoEm: string;
  numeroProcesso: string;
  protocoloNumero: string;
  descricao: string;
  observacoes: string;
}

const emptyForm = (origin: ProtocoloOrigin | null): FormState => ({
  tipo: "",
  protocoladoEm: "",
  numeroProcesso: origin?.processNumber ?? "",
  protocoloNumero: "",
  descricao: origin?.taskTitle ?? "",
  observacoes: "",
});

export function ProtocoloDialog({ open, tenantId, userId, origin, onOpenChange, onRegistered }: ProtocoloDialogProps): JSX.Element {
  const [form, setForm] = useState<FormState>(() => emptyForm(origin));
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Guarda o protocolo já gravado quando só o anexo falhou. */
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(origin));
    setFiles([]);
    setError(null);
    setRegisteredId(null);
  }, [open, origin]);

  const change = (field: keyof FormState) => (value: string) => setForm(current => ({ ...current, [field]: value }));

  const attach = async (protocolId: string): Promise<boolean> => {
    if (!files.length) return true;
    try {
      await attachProtocolDocuments({
        tenantId,
        protocolId,
        processId: origin?.processId ?? null,
        processNumber: form.numeroProcesso.trim() || null,
        userId,
        files,
      });
      return true;
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "Não foi possível anexar os comprovantes.");
      return false;
    }
  };

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (registeredId) {
      // O protocolo já está gravado: só falta o anexo, e repetir o registro
      // criaria um segundo ato para a mesma peça.
      setBusy(true);
      const attached = await attach(registeredId);
      setBusy(false);
      if (attached) onOpenChange(false);
      return;
    }

    if (!form.tipo || !form.protocoladoEm) {
      setError("Escolha o ato protocolado e informe a data do protocolo.");
      return;
    }
    if (!origin?.processId && !form.numeroProcesso.trim()) {
      setError("Informe o número do processo do ato protocolado.");
      return;
    }

    setBusy(true);
    let protocolId: string;
    try {
      const registered = await registerProtocol({
        tenantId,
        tipo: form.tipo,
        protocoladoEm: new Date(`${form.protocoladoEm}T12:00:00`).toISOString(),
        processoId: origin?.processId ?? null,
        numeroProcesso: form.numeroProcesso.trim() || null,
        protocoloNumero: form.protocoloNumero.trim() || null,
        descricao: form.descricao.trim() || null,
        observacoes: form.observacoes.trim() || null,
        responsavelId: null,
        tarefaId: origin?.taskId ?? null,
      });
      protocolId = registered.id;
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Não foi possível registrar o protocolo.");
      setBusy(false);
      return;
    }

    setRegisteredId(protocolId);
    const attached = await attach(protocolId);
    setBusy(false);
    await onRegistered();
    if (attached) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar protocolo</DialogTitle>
          <DialogDescription>
            {origin
              ? `Registrar o ato protocolado conclui o prazo "${origin.taskTitle}".`
              : "Lance a peça protocolada e guarde o comprovante junto ao processo."}
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {registeredId && <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">O protocolo já foi registrado. Tente enviar o comprovante novamente.</p>}

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="protocolo-tipo">Ato protocolado</Label>
              <Select value={form.tipo} onValueChange={change("tipo")}>
                <SelectTrigger id="protocolo-tipo" aria-label="Ato protocolado"><SelectValue placeholder="Escolha o ato" /></SelectTrigger>
                <SelectContent>{PROTOCOL_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocolo-data">Protocolado em</Label>
              <Input id="protocolo-data" type="date" value={form.protocoladoEm} onChange={event => change("protocoladoEm")(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="protocolo-processo">Número do processo</Label>
              <Input id="protocolo-processo" value={form.numeroProcesso} readOnly={Boolean(origin?.processNumber)} onChange={event => change("numeroProcesso")(event.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocolo-numero">Número do protocolo</Label>
              <Input id="protocolo-numero" value={form.protocoloNumero} onChange={event => change("protocoloNumero")(event.target.value)} placeholder="Recibo do tribunal" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocolo-descricao">Descrição</Label>
            <Input id="protocolo-descricao" value={form.descricao} onChange={event => change("descricao")(event.target.value)} placeholder="Ex.: contestação com preliminares" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocolo-observacoes">Observações</Label>
            <Textarea id="protocolo-observacoes" value={form.observacoes} onChange={event => change("observacoes")(event.target.value)} placeholder="O que mais precisa ficar registrado sobre este ato" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocolo-anexos">Comprovantes</Label>
            <Input id="protocolo-anexos" type="file" multiple onChange={event => setFiles(Array.from(event.target.files ?? []))} />
            <p className="text-xs text-muted-foreground">O comprovante fica anexado ao protocolo e aparece nos documentos do processo.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={busy} onClick={() => void submit()}>{registeredId ? "Tentar anexar novamente" : "Registrar protocolo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
