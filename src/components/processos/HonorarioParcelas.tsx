import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Trash2, CheckCircle } from "lucide-react";
import jsPDF from "jspdf";

interface Props {
  processoId: string;
  processoNumero: string;
  clienteNome?: string;
}

export const HonorarioParcelas = ({ processoId, processoNumero, clienteNome }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ valor: "", data_vencimento: "", descricao: "" });

  const fetchParcelas = async () => {
    const { data } = await supabase
      .from("honorario_parcelas")
      .select("*")
      .eq("processo_id", processoId)
      .order("numero_parcela");
    if (data) setParcelas(data);
  };

  useEffect(() => { fetchParcelas(); }, [processoId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valor || !form.data_vencimento) return;
    setLoading(true);
    const nextNum = parcelas.length + 1;
    const { error } = await supabase.from("honorario_parcelas").insert({
      processo_id: processoId,
      user_id: user!.id,
      numero_parcela: nextNum,
      valor: parseFloat(form.valor),
      data_vencimento: form.data_vencimento,
      descricao: form.descricao || `Parcela ${nextNum}`,
      status: "pendente",
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Parcela adicionada!" });
      setForm({ valor: "", data_vencimento: "", descricao: "" });
      setShowForm(false);
      fetchParcelas();
    }
    setLoading(false);
  };

  const togglePago = async (parcela: any) => {
    const newStatus = parcela.status === "pago" ? "pendente" : "pago";
    await supabase.from("honorario_parcelas").update({
      status: newStatus,
      data_pagamento: newStatus === "pago" ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", parcela.id);
    fetchParcelas();
  };

  const deleteParcela = async (id: string) => {
    await supabase.from("honorario_parcelas").delete().eq("id", id);
    fetchParcelas();
  };

  const gerarRecibo = (parcela: any) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("RECIBO DE HONORÁRIOS", 105, 25, { align: "center" });
    doc.setFontSize(10);
    doc.text("Albertino & Advogados Associados", 105, 33, { align: "center" });

    doc.setFontSize(12);
    const y = 55;
    doc.text(`Processo: ${processoNumero}`, 20, y);
    doc.text(`Cliente: ${clienteNome || "—"}`, 20, y + 10);
    doc.text(`Parcela: ${parcela.numero_parcela}/${parcelas.length}`, 20, y + 20);
    doc.text(`Descrição: ${parcela.descricao || "Honorários advocatícios"}`, 20, y + 30);
    doc.text(`Valor: R$ ${Number(parcela.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, y + 40);
    doc.text(`Vencimento: ${parcela.data_vencimento}`, 20, y + 50);
    doc.text(`Status: ${parcela.status === "pago" ? "PAGO" : "PENDENTE"}`, 20, y + 60);
    if (parcela.data_pagamento) {
      doc.text(`Data do Pagamento: ${parcela.data_pagamento}`, 20, y + 70);
    }

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 20, y + 90);
    doc.line(20, y + 110, 120, y + 110);
    doc.text("Assinatura", 70, y + 118, { align: "center" });

    doc.save(`recibo-parcela-${parcela.numero_parcela}-${processoNumero}.pdf`);
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const totalHonorarios = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const totalPago = parcelas.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">Honorários por Parcela</h4>
          <p className="text-xs text-muted-foreground">
            Total: {formatCurrency(totalHonorarios)} • Pago: {formatCurrency(totalPago)} • Restante: {formatCurrency(totalHonorarios - totalPago)}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Parcela
        </Button>
      </div>

      {parcelas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela cadastrada</p>
      ) : (
        <div className="space-y-2">
          {parcelas.map((p) => (
            <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.status === "pago" ? "bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20" : "bg-card"}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => togglePago(p)} className="shrink-0">
                  <CheckCircle className={`w-5 h-5 ${p.status === "pago" ? "text-[hsl(var(--success))]" : "text-muted-foreground/30"}`} />
                </button>
                <div>
                  <p className={`text-sm font-medium ${p.status === "pago" ? "line-through text-muted-foreground" : ""}`}>
                    Parcela {p.numero_parcela} — {formatCurrency(Number(p.valor))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Venc: {p.data_vencimento} {p.descricao ? `• ${p.descricao}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => gerarRecibo(p)} title="Gerar Recibo PDF">
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteParcela(p.id)} title="Excluir">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Parcela de Honorário</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder={`Parcela ${parcelas.length + 1}`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} required />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Adicionar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
