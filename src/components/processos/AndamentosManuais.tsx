import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileClock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

export interface AndamentoManual {
  id: string;
  data_andamento: string | null;
  tipo: string | null;
  descricao: string | null;
  tribunal: string | null;
  origem: string | null;
  user_id: string | null;
}

interface Props {
  tenantId: string;
  processId: string;
  processNumber: string;
  currentUserId: string | null;
  items: AndamentoManual[];
  onChanged: () => void | Promise<void>;
}

interface FormState {
  tipo: string;
  descricao: string;
  tribunal: string;
  data: string;
}

const emptyForm: FormState = {
  tipo: "Andamento",
  descricao: "",
  tribunal: "",
  data: "",
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return "Data não informada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data não informada";
  return format(parsed, "dd/MM/yyyy", { locale: ptBR });
}

export function AndamentosManuais({
  tenantId,
  processId,
  processNumber,
  currentUserId,
  items,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<AndamentoManual | null>(null);
  const [removing, setRemoving] = useState<AndamentoManual | null>(null);
  const [saving, setSaving] = useState(false);

  const manualItems = items.filter((item) => (item.origem ?? "manual") === "manual");

  const openCreate = () => {
    setForm({ ...emptyForm, data: new Date().toISOString().slice(0, 10) });
    setEditing({ id: "", data_andamento: null, tipo: null, descricao: null, tribunal: null, origem: "manual", user_id: currentUserId });
  };

  const openEdit = (item: AndamentoManual) => {
    setForm({
      tipo: item.tipo ?? "Andamento",
      descricao: decodeHtmlEntities(item.descricao ?? ""),
      tribunal: item.tribunal ?? "",
      data: toDateInput(item.data_andamento),
    });
    setEditing(item);
  };

  const save = async () => {
    if (!editing || !form.descricao.trim()) return;
    setSaving(true);

    const occurredAt = form.data
      ? new Date(`${form.data}T12:00:00`).toISOString()
      : new Date().toISOString();
    const payload = {
      tipo: form.tipo.trim() || "Andamento",
      descricao: form.descricao.trim(),
      tribunal: form.tribunal.trim() || null,
      data_andamento: occurredAt,
    };

    const client = supabase as unknown as {
      from: (table: string) => {
        insert: (values: Record<string, unknown>) => Promise<{ error: unknown }>;
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      };
    };

    const result = editing.id
      ? await client.from("andamentos").update(payload)
        .eq("tenant_id", tenantId).eq("id", editing.id)
      : await client.from("andamentos").insert({
        ...payload,
        tenant_id: tenantId,
        processo_id: processId,
        numero_processo: processNumber,
        origem: "manual",
        user_id: currentUserId,
      });

    setSaving(false);

    if (result.error) {
      toast({
        title: editing.id
          ? "Não foi possível salvar a alteração"
          : "Não foi possível registrar",
        description: "Confira se você tem permissão para editar dados jurídicos.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: editing.id ? "Andamento atualizado" : "Andamento registrado" });
    setEditing(null);
    setForm(emptyForm);
    await onChanged();
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);

    const client = supabase as unknown as {
      from: (table: string) => {
        delete: () => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      };
    };

    const { error } = await client.from("andamentos").delete()
      .eq("tenant_id", tenantId).eq("id", removing.id);
    setSaving(false);

    if (error) {
      toast({
        title: "Não foi possível excluir",
        description:
          "Você pode excluir os andamentos que registrou; para os demais é preciso permissão de exclusão.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Andamento excluído" });
    setRemoving(null);
    await onChanged();
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Andamentos do escritório</h2>
          <p className="text-xs text-muted-foreground">
            Registros feitos pela equipe. Movimentações oficiais aparecem na
            timeline e não podem ser alteradas.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo andamento
        </Button>
      </div>

      {manualItems.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <FileClock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Nenhum andamento registrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use “Novo andamento” para anotar diligências e tratativas do caso.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {manualItems.map((item) => {
            const isAuthor = Boolean(currentUserId) &&
              item.user_id === currentUserId;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.tipo || "Andamento"}</Badge>
                    {item.tribunal && (
                      <Badge variant="secondary">{item.tribunal}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.data_andamento)}
                    </span>
                    {!isAuthor && (
                      <span className="text-xs text-muted-foreground">
                        · registrado por outro membro
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">
                    {decodeHtmlEntities(item.descricao ?? "")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar andamento"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir andamento"
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar andamento" : "Novo andamento"}
            </DialogTitle>
            <DialogDescription>
              O registro fica visível para toda a equipe do escritório.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="andamento-tipo">Tipo</Label>
                <Input
                  id="andamento-tipo"
                  value={form.tipo}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, tipo: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="andamento-data">Data</Label>
                <Input
                  id="andamento-data"
                  type="date"
                  value={form.data}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, data: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="andamento-tribunal">Tribunal</Label>
              <Input
                id="andamento-tribunal"
                placeholder="Opcional"
                value={form.tribunal}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tribunal: event.target.value,
                  }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="andamento-descricao">Descrição</Label>
              <Textarea
                id="andamento-descricao"
                rows={5}
                value={form.descricao}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    descricao: event.target.value,
                  }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saving || !form.descricao.trim()}
              onClick={() => void save()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing?.id ? "Salvar alteração" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir andamento</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O registro sai da timeline do
              processo.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border bg-muted/30 p-3 text-sm">
            {decodeHtmlEntities(removing?.descricao ?? "")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void remove()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
