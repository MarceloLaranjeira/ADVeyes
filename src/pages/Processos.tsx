import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AreaBadge } from "@/components/common/AreaBadge";
import { Search, Plus, Pencil, Trash2, Filter, Download, DollarSign } from "lucide-react";
import { exportProcessosPDF } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ProcessoForm } from "@/components/processos/ProcessoForm";
import { HonorarioParcelas } from "@/components/processos/HonorarioParcelas";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const areas = ["Todas", "Penal", "Cível", "Família", "Execução Penal", "Recurso", "Trabalhista"];
const statuses = ["Todos", "Em andamento", "Aguardando audiência", "Sentença proferida", "Recurso interposto", "Arquivado"];

const Processos = () => {
  const { toast } = useToast();
  const [processos, setProcessos] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [honorarioProcesso, setHonorarioProcesso] = useState<any>(null);
  const [filterArea, setFilterArea] = useState("Todas");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchProcessos = async () => {
    const { data } = await supabase.from("processos").select("*").order("created_at", { ascending: false });
    if (data) setProcessos(data);
  };

  useEffect(() => { fetchProcessos(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("processos").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Processo excluído!" });
      fetchProcessos();
    }
    setDeleteId(null);
  };

  const filtered = processos.filter((p) => {
    const matchSearch = p.numero.toLowerCase().includes(search.toLowerCase()) ||
      (p.cliente_nome || "").toLowerCase().includes(search.toLowerCase());
    const matchArea = filterArea === "Todas" || p.area === filterArea;
    const matchStatus = filterStatus === "Todos" || p.status === filterStatus;
    const matchDateFrom = !filterDateFrom || new Date(p.created_at) >= new Date(filterDateFrom);
    const matchDateTo = !filterDateTo || new Date(p.created_at) <= new Date(filterDateTo + "T23:59:59");
    return matchSearch && matchArea && matchStatus && matchDateFrom && matchDateTo;
  });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif">Processos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerenciamento de todos os processos do escritório</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportProcessosPDF(filtered)} className="gap-2"><Download className="w-4 h-4" /> PDF</Button>
            <Button onClick={() => { setEditData(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Novo Processo</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por número ou cliente..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-[160px]"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
            <SelectContent>{areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" className="w-[150px]" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} placeholder="De" />
          <Input type="date" className="w-[150px]" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} placeholder="Até" />
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Número</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Área</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vara/Câmara</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Advogado</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum processo encontrado</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm font-mono">{p.numero}</td>
                  <td className="p-4 text-sm font-medium">{p.cliente_nome}</td>
                  <td className="p-4"><AreaBadge area={p.area} /></td>
                  <td className="p-4 text-sm text-muted-foreground">{p.vara || "—"}</td>
                  <td className="p-4 text-sm">{p.status}</td>
                  <td className="p-4 text-sm text-muted-foreground">{p.advogado || "—"}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHonorarioProcesso(p)} title="Honorários">
                        <DollarSign className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditData(p); setShowForm(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ProcessoForm open={showForm} onOpenChange={setShowForm} onSuccess={fetchProcessos} editData={editData} />

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. O processo será removido permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Honorários Dialog */}
        <Dialog open={!!honorarioProcesso} onOpenChange={(open) => !open && setHonorarioProcesso(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Honorários — {honorarioProcesso?.numero}</DialogTitle></DialogHeader>
            {honorarioProcesso && (
              <HonorarioParcelas
                processoId={honorarioProcesso.id}
                processoNumero={honorarioProcesso.numero}
                clienteNome={honorarioProcesso.cliente_nome}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Processos;
