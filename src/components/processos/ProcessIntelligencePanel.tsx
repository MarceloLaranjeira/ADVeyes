import { Bot, Clock3, Loader2, RefreshCw, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useProcessIntelligence } from "@/hooks/useProcessIntelligence";
import { PHASE_LABELS, RISK_LABELS, WAITING_LABELS } from "@/lib/process-intelligence-workspace";
import { usePlatformSupport } from "@/contexts/PlatformSupportContext";

export function ProcessIntelligencePanel({ tenantId, processId }: { tenantId: string; processId: string }) {
  const query = useProcessIntelligence(tenantId, { incluirArquivados: true });
  const { toast } = useToast();
  const support = usePlatformSupport();
  const item = query.items.find(candidate => candidate.id === processId);
  const insight = item?.intelligence;
  const supportRequired = support.isPlatformAccess && !support.active;
  const analyze = async () => {
    try { await query.analyze.mutateAsync(processId); toast({ title: "Leitura processual atualizada" }); }
    catch { toast({ title: "Não foi possível atualizar a leitura", variant: "destructive" }); }
  };
  if (query.loading) return <Card className="mb-5"><CardContent className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;
  return (
    <Card className="mb-5 overflow-hidden border-primary/20"><CardContent className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><h2 className="font-serif text-lg font-semibold">Inteligência processual</h2>{insight ? <Badge variant="outline">{RISK_LABELS[insight.risk]}</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">Leitura operacional baseada nos andamentos e prazos vinculados.</p></div><Button variant="outline" size="sm" className="gap-2" disabled={query.analyze.isPending || supportRequired} title={supportRequired ? "Ative o suporte temporário no aviso acima para reanalisar." : undefined} onClick={() => void analyze()}>{query.analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{supportRequired ? "Suporte necessário" : insight ? "Reanalisar" : "Analisar agora"}</Button></div>
      {insight ? <><div className="mt-4 grid gap-3 sm:grid-cols-4"><Metric label="Fase" value={PHASE_LABELS[insight.phase]} /><Metric label="Etapa" value={insight.stage.replaceAll("_", " ")} /><Metric label="Aguardando" value={WAITING_LABELS[insight.waitingOn]} /><Metric label="Sem avanço" value={insight.lastAdvanceAt ? `${insight.stalledDays} dias` : "Sem histórico"} /></div><div className="mt-3 grid gap-3 lg:grid-cols-2"><div className="rounded-xl border bg-muted/30 p-3"><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Por que não anda</p><p className="mt-2 text-sm">{insight.waitingReason || "Não há evidência suficiente para determinar o motivo."}</p></div><div className="rounded-xl border bg-muted/30 p-3"><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground"><UserRoundCheck className="h-3.5 w-3.5" /> Próxima ação</p><p className="mt-2 text-sm font-medium">{insight.nextAction || "Revisar o último andamento e definir a providência."}</p></div></div><p className="mt-3 text-[11px] text-muted-foreground">Confiança {insight.confidence} · {insight.origin === "manual" ? "revisão humana" : "classificação automática"} · {insight.evidence.length} evidência(s)</p></> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center"><p className="text-sm font-medium">Este processo ainda não foi analisado</p><p className="mt-1 text-xs text-muted-foreground">A análise também será feita automaticamente pela fila.</p></div>}
    </CardContent></Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold capitalize">{value}</p></div>; }
