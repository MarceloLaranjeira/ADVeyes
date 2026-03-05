import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const areas = ["Penal", "Cível", "Família", "Execução Penal", "Recurso", "Trabalhista"];
const statuses = ["Em andamento", "Aguardando audiência", "Sentença proferida", "Recurso interposto", "Arquivado"];

interface ProcessoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ProcessoForm = ({ open, onOpenChange, onSuccess }: ProcessoFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    numero: "", cliente_nome: "", area: "Cível", status: "Em andamento",
    vara: "", advogado: "", descricao: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero.trim() || !form.cliente_nome.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("processos").insert({
      ...form, user_id: user!.id,
    });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Processo cadastrado com sucesso!" });
      setForm({ numero: "", cliente_nome: "", area: "Cível", status: "Em andamento", vara: "", advogado: "", descricao: "" });
      onOpenChange(false);
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número do Processo *</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="0001234-56.2024.8.04.0001" required />
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} placeholder="Nome do cliente" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vara/Câmara</Label>
              <Input value={form.vara} onChange={(e) => setForm({ ...form, vara: e.target.value })} placeholder="1ª Vara Criminal" />
            </div>
            <div className="space-y-2">
              <Label>Advogado Responsável</Label>
              <Input value={form.advogado} onChange={(e) => setForm({ ...form, advogado: e.target.value })} placeholder="Dr. Albertino" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes do processo..." />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Cadastrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
