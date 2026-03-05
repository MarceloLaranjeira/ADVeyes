import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Clock, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Financeiro = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [registros, setRegistros] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente",
  });

  const fetchData = async () => {
    const { data } = await supabase.from("financeiro").select("*").order("created_at", { ascending: false });
    if (data) setRegistros(data);
  };

  useEffect(() => { fetchData(); }, []);

  const totalRecebido = registros.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor), 0);
  const totalPendente = registros.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor), 0);
  const totalAtrasado = registros.filter(r => r.status === "atrasado").reduce((s, r) => s + Number(r.valor), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("financeiro").insert({
      ...form, valor: parseFloat(form.valor), user_id: user!.id,
      data_vencimento: form.data_vencimento || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lançamento registrado!" });
      setForm({ tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente" });
      setShowForm(false);
      fetchData();
    }
    setLoading(false);
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif">Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">Controle de honorários e pagamentos</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Lançamento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Geral</p>
                <p className="text-xl font-bold">{formatCurrency(totalRecebido + totalPendente + totalAtrasado)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[hsl(var(--success))]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-xl font-bold text-[hsl(var(--success))]">{formatCurrency(totalRecebido)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold text-[hsl(var(--warning))]">{formatCurrency(totalPendente)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atrasado</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(totalAtrasado)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Vencimento</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {registros.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum lançamento registrado</td></tr>
              )}
              {registros.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm capitalize">{r.tipo}</td>
                  <td className="p-4 text-sm">{r.descricao}</td>
                  <td className="p-4 text-sm font-medium">{formatCurrency(Number(r.valor))}</td>
                  <td className="p-4 text-sm text-muted-foreground">{r.data_vencimento || "—"}</td>
                  <td className="p-4">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      r.status === "pago" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                      r.status === "atrasado" ? "bg-destructive/10 text-destructive" :
                      "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lançamento Financeiro</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honorario">Honorário</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="custas">Custas Processuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do lançamento" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" required />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Registrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Financeiro;
