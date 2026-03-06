import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, FileText, Gavel, LogOut, FolderOpen } from "lucide-react";

const PortalDashboard = () => {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<any>(null);
  const [processos, setProcessos] = useState<any[]>([]);
  const [audiencias, setAudiencias] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("portal_token");
    if (!token) {
      navigate("/portal");
      return;
    }
    fetchData(token);
  }, []);

  const fetchData = async (token: string) => {
    // Re-validate token server-side on every load
    const { data: access, error: accessError } = await supabase
      .from("portal_acessos")
      .select("cliente_id")
      .eq("token", token)
      .eq("ativo", true)
      .maybeSingle();

    if (accessError || !access) {
      sessionStorage.removeItem("portal_token");
      sessionStorage.removeItem("portal_cliente_id");
      navigate("/portal");
      return;
    }

    const clienteId = access.cliente_id;
    sessionStorage.setItem("portal_cliente_id", clienteId);

    const [cliRes, procRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clienteId).single(),
      supabase.from("processos").select("*").eq("cliente_id", clienteId).order("updated_at", { ascending: false }),
    ]);

    setCliente(cliRes.data);
    const procs = procRes.data || [];
    setProcessos(procs);

    if (procs.length > 0) {
      const procIds = procs.map((p: any) => p.id);
      const [audRes, docRes] = await Promise.all([
        supabase.from("audiencias").select("*").in("processo_id", procIds).order("data_hora", { ascending: false }).limit(10),
        supabase.from("documentos").select("*").in("processo_id", procIds).order("created_at", { ascending: false }).limit(20),
      ]);
      setAudiencias(audRes.data || []);
      setDocumentos(docRes.data || []);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("portal_token");
    sessionStorage.removeItem("portal_cliente_id");
    navigate("/portal");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === "Encerrado" || s === "Arquivado") return "bg-muted text-muted-foreground";
    if (s === "Suspenso") return "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]";
    return "bg-primary/10 text-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg">Portal do Cliente</h1>
            <p className="text-xs text-muted-foreground">{cliente?.nome}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" /> Sair
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Processos */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="w-5 h-5 text-primary" />
              <h2 className="font-serif font-semibold text-lg">Meus Processos</h2>
            </div>
            {processos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum processo encontrado</p>
            ) : (
              <div className="space-y-3">
                {processos.map((p) => (
                  <div key={p.id} className="p-4 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{p.numero}</p>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.area} {p.vara ? `• ${p.vara}` : ""}</p>
                    {p.descricao && <p className="text-xs text-muted-foreground mt-1">{p.descricao}</p>}
                    <p className="text-[10px] text-muted-foreground mt-2">Última atualização: {new Date(p.updated_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audiências */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="w-5 h-5 text-primary" />
              <h2 className="font-serif font-semibold text-lg">Audiências</h2>
            </div>
            {audiencias.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma audiência registrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Data/Hora</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Local</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {audiencias.map((a) => (
                      <tr key={a.id}>
                        <td className="p-3 text-sm">{new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td className="p-3 text-sm">{a.tipo}</td>
                        <td className="p-3 text-sm text-muted-foreground">{a.local || a.vara || "—"}</td>
                        <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "Realizada" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-primary/10 text-primary"}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-serif font-semibold text-lg">Documentos</h2>
            </div>
            {documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento disponível</p>
            ) : (
              <div className="space-y-2">
                {documentos.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{d.nome}</p>
                        <p className="text-xs text-muted-foreground">{d.tipo} • {new Date(d.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PortalDashboard;
