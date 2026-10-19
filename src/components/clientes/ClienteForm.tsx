import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];

interface ClienteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: Partial<Cliente>;
}

const EMPTY_FORM = {
  nome: "", cpf: "", telefone: "", email: "", endereco: "", observacoes: "",
  data_nascimento: "", profissao: "", origem: "",
};

const ORIGIN_SUGGESTIONS = ["Indicação", "Site", "Redes sociais", "WhatsApp", "Balcão", "Outra"];

export const ClienteForm = ({ open, onOpenChange, onSuccess, editData }: ClienteFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (editData) {
      setForm({
        nome: editData.nome || "",
        cpf: editData.cpf || "",
        telefone: editData.telefone || "",
        email: editData.email || "",
        endereco: editData.endereco || "",
        observacoes: editData.observacoes || "",
        data_nascimento: editData.data_nascimento || "",
        profissao: editData.profissao || "",
        origem: editData.origem || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editData, open]);

  // Campos opcionais vazios viram null: o banco rejeita texto vazio e data inválida.
  const payload = () => ({
    ...form,
    data_nascimento: form.data_nascimento || null,
    profissao: form.profissao.trim() || null,
    origem: form.origem.trim() || null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setLoading(true);

    if (editData) {
      const { error } = await supabase.from("clientes").update(payload()).eq("id", editData.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Cliente atualizado!" });
        onOpenChange(false);
        onSuccess();
      }
    } else {
      const { error } = await supabase.from("clientes").insert({ ...payload(), user_id: user!.id });
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Cliente cadastrado com sucesso!" });
        setForm(EMPTY_FORM);
        onOpenChange(false);
        onSuccess();
      }
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editData ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do cliente" required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(92) 99999-0000" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@email.com" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nascimento</Label>
              <Input type="date" value={form.data_nascimento} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Profissão</Label>
              <Input value={form.profissao} maxLength={120} onChange={(e) => setForm({ ...form, profissao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input value={form.origem} maxLength={120} list="origens-contato" onChange={(e) => setForm({ ...form, origem: e.target.value })} placeholder="Indicação, site..." />
              <datalist id="origens-contato">
                {ORIGIN_SUGGESTIONS.map((origin) => <option key={origin} value={origin} />)}
              </datalist>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações sobre o cliente..." />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editData ? "Salvar" : "Cadastrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
