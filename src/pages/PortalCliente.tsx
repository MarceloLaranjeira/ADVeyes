import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserCircle, Plus, Copy, Trash2, ExternalLink, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Acesso {
  id: string;
  token: string;
  ativo: boolean;
  ultimo_acesso?: string;
  clientes?: { nome?: string; email?: string } | null;
}

interface Cliente {
  id: string;
  nome: string;
  email?: string;
}

const PortalCliente = () => {
  const { toast } = useToast();
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState("");

  const fetchData = async () => {
    const [aRes, cRes] = await Promise.all([
      supabase.from("portal_acessos").select("*, clientes(nome, email)").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome, email"),
    ]);
    setAcessos(aRes.data || []);
    setClientes(cRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const criarAcesso = async () => {
    if (!selectedCliente) return;
    const { error } = await supabase.from("portal_acessos").insert({
      cliente_id: selectedCliente,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Acesso criado!" });
      setShowForm(false);
      setSelectedCliente("");
      fetchData();
    }
  };

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/portal?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const copiarToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Token copiado!" });
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("portal_acessos").update({ ativo: !ativo }).eq("id", id);
    fetchData();
  };

  const deletarAcesso = async (id: string) => {
    await supabase.from("portal_acessos").delete().eq("id", id);
    fetchData();
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Portal do Cliente</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie os acessos dos clientes ao portal</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Criar Acesso
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Como funciona</h3>
                <p className="text-sm text-muted-foreground">
                  Crie um acesso para cada cliente. Um token exclusivo será gerado. Copie o link ou token e envie ao cliente.
                  Ele poderá acessar o portal em <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/portal</code> e consultar processos, audiências e documentos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de acessos */}
        <div className="space-y-3">
          {acessos.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-lg border">
              <UserCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nenhum acesso criado</h3>
              <p className="text-sm text-muted-foreground">Crie um acesso para permitir que seus clientes acompanhem os processos.</p>
            </div>
          ) : (
            acessos.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{a.clientes?.nome || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      Token: <code className="bg-muted px-1.5 py-0.5 rounded">{a.token.slice(0, 12)}...</code>
                      {a.ultimo_acesso && ` • Último acesso: ${new Date(a.ultimo_acesso).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.ativo ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-muted text-muted-foreground"}`}>
                      {a.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copiarLink(a.token)} title="Copiar link">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copiarToken(a.token)} title="Copiar token">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAtivo(a.id, a.ativo)} title={a.ativo ? "Desativar" : "Ativar"}>
                      <UserCircle className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletarAcesso(a.id)} title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Acesso ao Portal</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Selecione o Cliente</label>
                <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                  <SelectTrigger><SelectValue placeholder="Escolha um cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={criarAcesso} disabled={!selectedCliente}>Criar Acesso</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default PortalCliente;
