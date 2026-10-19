import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { officeService, type Partner, type PartnerProcess } from "@/services/office";

interface ProcessOption { id: string; numero: string }

const emptyPartner = { nome: "", email: "", telefone: "", oab: "" };
const emptyShare = { parceiroId: "", processoId: "", tipoAcao: "", direcao: "compartilhado" as "compartilhado" | "recebido" };

const Parceiros = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.tenantId ?? null;
  // A permissão de escrita é imposta pelo banco (RLS); a tela só some sem escritório.
  const canWrite = Boolean(currentTenant);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [shared, setShared] = useState<PartnerProcess[]>([]);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [working, setWorking] = useState(false);
  const [partnerForm, setPartnerForm] = useState(emptyPartner);
  const [shareForm, setShareForm] = useState(emptyShare);
  const [filter, setFilter] = useState("todos");

  const report = useCallback((error: unknown, action: string) => {
    toast({ title: `Não foi possível ${action}`, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
  }, [toast]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [nextPartners, nextShared, procs] = await Promise.all([
        officeService.listPartners(tenantId),
        officeService.listSharedProcesses(tenantId),
        supabase.from("processos").select("id, numero").eq("tenant_id", tenantId).is("deleted_at", null).order("numero").limit(500),
      ]);
      setPartners(nextPartners);
      setShared(nextShared);
      setProcesses(procs.data ?? []);
    } catch (error) {
      report(error, "carregar os parceiros");
    }
  }, [report, tenantId]);

  useEffect(() => { void load(); }, [load]);

  const partnerName = useMemo(() => new Map(partners.map((p) => [p.id, p.nome])), [partners]);
  const processNumber = useMemo(() => new Map(processes.map((p) => [p.id, p.numero])), [processes]);
  const visible = shared.filter((item) => filter === "todos" || item.parceiro_id === filter);
  const pendingOffice = shared.filter((s) => s.demanda_pendente && s.direcao === "recebido").length;
  const pendingPartner = shared.filter((s) => s.demanda_pendente && s.direcao === "compartilhado").length;
  const byAction = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of shared) counts.set(item.tipo_acao || "Sem tipo", (counts.get(item.tipo_acao || "Sem tipo") ?? 0) + 1);
    return [...counts].map(([name, value]) => ({ name, value }));
  }, [shared]);

  const run = async (action: () => Promise<void>, failure: string) => {
    setWorking(true);
    try {
      await action();
      await load();
    } catch (error) {
      report(error, failure);
    } finally {
      setWorking(false);
    }
  };

  const addPartner = (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !user || !partnerForm.nome.trim()) return;
    void run(async () => {
      await officeService.createPartner(tenantId, user.id, {
        nome: partnerForm.nome, email: partnerForm.email.trim() || null,
        telefone: partnerForm.telefone.trim() || null, oab: partnerForm.oab.trim() || null, observacoes: null,
      });
      setPartnerForm(emptyPartner);
    }, "cadastrar o parceiro");
  };

  const share = (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !user || !shareForm.parceiroId || !shareForm.processoId) return;
    void run(async () => {
      await officeService.shareProcess(tenantId, user.id, {
        parceiroId: shareForm.parceiroId, processoId: shareForm.processoId,
        tipoAcao: shareForm.tipoAcao.trim() || null, direcao: shareForm.direcao,
      });
      setShareForm(emptyShare);
    }, "compartilhar o processo");
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-serif tracking-tight">Parceiros</h1>
          <p className="text-muted-foreground text-sm mt-1">Rede de escritórios, processos compartilhados e demandas entre parceiros.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Processos compartilhados", value: shared.length },
            { label: "Demanda pendente pelo escritório", value: pendingOffice },
            { label: "Demanda pendente pelo parceiro", value: pendingPartner },
          ].map((stat) => (
            <Card key={stat.label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
            </CardContent></Card>
          ))}
        </div>

        <Card><CardContent className="p-6">
          <h2 className="text-sm font-semibold mb-3">Processos compartilhados por tipo de ação</h2>
          <div className="h-52" role="img" aria-label="Processos compartilhados por tipo de ação">
            {byAction.length === 0 ? (
              <p className="h-full flex items-center justify-center text-sm text-muted-foreground">Nenhum processo compartilhado ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byAction}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} width={30} />
                  <Tooltip />
                  <Bar dataKey="value" name="Processos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-6 space-y-4">
          <h2 className="text-sm font-semibold">Rede</h2>
          {canWrite && (
            <form onSubmit={addPartner} className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]">
              <Input aria-label="Nome do parceiro" placeholder="Nome do escritório ou advogado" value={partnerForm.nome} onChange={(e) => setPartnerForm({ ...partnerForm, nome: e.target.value })} maxLength={160} />
              <Input aria-label="E-mail" type="email" placeholder="E-mail" value={partnerForm.email} onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })} />
              <Input aria-label="Telefone" placeholder="Telefone" value={partnerForm.telefone} onChange={(e) => setPartnerForm({ ...partnerForm, telefone: e.target.value })} />
              <Input aria-label="OAB" placeholder="OAB" value={partnerForm.oab} onChange={(e) => setPartnerForm({ ...partnerForm, oab: e.target.value })} />
              <Button type="submit" size="sm" disabled={working || !partnerForm.nome.trim()} className="gap-1">
                {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Novo parceiro
              </Button>
            </form>
          )}
          {partners.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado.</p> : (
            <ul className="divide-y">
              {partners.map((partner) => (
                <li key={partner.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className={partner.ativo ? "" : "text-muted-foreground line-through"}>
                    {partner.nome}{partner.oab ? ` · OAB ${partner.oab}` : ""}{partner.email ? ` · ${partner.email}` : ""}
                  </span>
                  <Switch checked={partner.ativo} aria-label={`Ativar ${partner.nome}`}
                    onCheckedChange={(checked) => tenantId && void run(() => officeService.setPartnerActive(tenantId, partner.id, checked), "atualizar o parceiro")} />
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Processos compartilhados</h2>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-56" aria-label="Filtrar por parceiro"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os parceiros</SelectItem>
                {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canWrite && partners.length > 0 && (
            <form onSubmit={share} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Select value={shareForm.parceiroId} onValueChange={(v) => setShareForm({ ...shareForm, parceiroId: v })}>
                <SelectTrigger aria-label="Parceiro"><SelectValue placeholder="Parceiro" /></SelectTrigger>
                <SelectContent>{partners.filter((p) => p.ativo).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={shareForm.processoId} onValueChange={(v) => setShareForm({ ...shareForm, processoId: v })}>
                <SelectTrigger aria-label="Processo"><SelectValue placeholder="Processo" /></SelectTrigger>
                <SelectContent>{processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero}</SelectItem>)}</SelectContent>
              </Select>
              <Input aria-label="Tipo de ação" placeholder="Tipo de ação" value={shareForm.tipoAcao} onChange={(e) => setShareForm({ ...shareForm, tipoAcao: e.target.value })} />
              <Select value={shareForm.direcao} onValueChange={(v) => setShareForm({ ...shareForm, direcao: v as "compartilhado" | "recebido" })}>
                <SelectTrigger aria-label="Direção"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compartilhado">Compartilhei</SelectItem>
                  <SelectItem value="recebido">Recebi</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={working || !shareForm.parceiroId || !shareForm.processoId}>Compartilhar</Button>
            </form>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Parceiro</th>
                  <th className="py-2 pr-4 font-medium">Processo</th>
                  <th className="py-2 pr-4 font-medium">Tipo de ação</th>
                  <th className="py-2 pr-4 font-medium">Direção</th>
                  <th className="py-2 font-medium">Demanda pendente</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>
                ) : visible.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="py-2 pr-4">{partnerName.get(item.parceiro_id) ?? "—"}</td>
                    <td className="py-2 pr-4">{processNumber.get(item.processo_id) ?? item.processo_id}</td>
                    <td className="py-2 pr-4">{item.tipo_acao ?? "—"}</td>
                    <td className="py-2 pr-4">{item.direcao === "recebido" ? "Recebido" : "Compartilhado"}</td>
                    <td className="py-2">
                      <Switch checked={item.demanda_pendente} aria-label="Demanda pendente"
                        onCheckedChange={(checked) => tenantId && void run(() => officeService.setDemand(tenantId, item.id, checked, null), "atualizar a demanda")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
};

export default Parceiros;
