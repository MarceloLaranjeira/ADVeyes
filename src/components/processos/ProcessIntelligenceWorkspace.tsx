import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Clock3, PencilLine, Scale, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PHASE_LABELS, RISK_LABELS, WAITING_LABELS, sortByAttention } from "@/lib/process-intelligence-workspace";
import type { ProcessIntelligenceItem, ProcessIntelligenceManualOverride, ProcessPhase, WaitingOn } from "@/types/process-intelligence";

const riskClass = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  atencao: "border-amber-200 bg-amber-50 text-amber-700",
  alto: "border-orange-200 bg-orange-50 text-orange-700",
  critico: "border-red-200 bg-red-50 text-red-700",
};

function RiskBadge({ item }: { item: ProcessIntelligenceItem }) {
  const risk = item.intelligence?.risk ?? "normal";
  return <Badge variant="outline" className={riskClass[risk]}>{item.intelligence ? RISK_LABELS[risk] : "Aguardando análise"}</Badge>;
}

function ProcessSummary({ item }: { item: ProcessIntelligenceItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-xs font-semibold text-primary">{item.number}</p>
      <p className="mt-1 truncate text-sm font-semibold">{item.clientName || "Cliente não informado"}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.courtUnit || item.court || "Órgão julgador não informado"}</p>
    </div>
  );
}

export function IntelligenceCentral({ items, onCorrect }: { items: ProcessIntelligenceItem[]; onCorrect: (item: ProcessIntelligenceItem) => void }) {
  const navigate = useNavigate();
  const ordered = useMemo(() => sortByAttention(items), [items]);
  if (!ordered.length) return <Empty />;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {ordered.map(item => {
        const intelligence = item.intelligence;
        return (
          <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-md">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><ProcessSummary item={item} /><RiskBadge item={item} /></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Fact label="Fase" value={intelligence ? PHASE_LABELS[intelligence.phase] : "Não analisada"} />
                <Fact label="Etapa" value={intelligence?.stage.replaceAll("_", " ") ?? "—"} />
                <Fact label="Aguardando" value={intelligence ? WAITING_LABELS[intelligence.waitingOn] : "—"} />
                <Fact label="Sem avanço" value={intelligence?.lastAdvanceAt ? `${intelligence.stalledDays} dias` : "Sem histórico"} />
              </div>
              <div className="mt-3 rounded-xl border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Por que não anda</p>
                <p className="mt-1 text-sm">{intelligence?.waitingReason || "Ainda não há evidência suficiente para explicar a paralisação."}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Próxima ação recomendada</p>
                <p className="mt-1 text-sm font-medium">{intelligence?.nextAction || "Revisar o último andamento e definir a próxima providência."}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {intelligence?.origin === "manual" ? <PencilLine className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  {intelligence ? `${intelligence.origin === "manual" ? "Revisado" : "Automático"} · confiança ${intelligence.confidence}` : "Na fila de inteligência"}
                </span>
                <div className="flex gap-2">
                  {intelligence ? <Button variant="ghost" size="sm" className="h-8" onClick={() => onCorrect(item)}>Corrigir leitura</Button> : null}
                  <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => navigate(`/processos/${item.id}`)}>Abrir <ArrowRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-background p-2.5"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 truncate font-medium capitalize" title={value}>{value}</p></div>;
}

const PIPELINE: ProcessPhase[] = ["conhecimento", "recursal", "cumprimento_execucao", "suspenso_sobrestado", "arquivado_encerrado", "nao_identificada"];

export function IntelligencePipeline({ items }: { items: ProcessIntelligenceItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
      {PIPELINE.map(phase => {
        const phaseItems = items.filter(item => (item.intelligence?.phase ?? "nao_identificada") === phase);
        return (
          <section key={phase} className="min-w-0 rounded-xl border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-xs font-bold">{PHASE_LABELS[phase]}</h2><Badge variant="secondary">{phaseItems.length}</Badge></div>
            <div className="space-y-2">
              {sortByAttention(phaseItems).map(item => (
                <button key={item.id} type="button" onClick={() => navigate(`/processos/${item.id}`)} className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <p className="truncate font-mono text-[10px] font-semibold">{item.number}</p><p className="mt-1 truncate text-xs font-medium">{item.clientName || "Sem cliente"}</p>
                  <div className="mt-2 flex items-center justify-between"><span className="truncate text-[10px] text-muted-foreground">{item.intelligence ? WAITING_LABELS[item.intelligence.waitingOn] : "Não analisado"}</span><RiskBadge item={item} /></div>
                </button>
              ))}
              {!phaseItems.length ? <p className="py-6 text-center text-[11px] text-muted-foreground">Nenhum processo</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function IntelligenceList({ items }: { items: ProcessIntelligenceItem[] }) {
  const navigate = useNavigate();
  if (!items.length) return <Empty />;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Processo / cliente</th><th className="p-3">Fase e etapa</th><th className="p-3">Aguardando</th><th className="p-3">Último avanço</th><th className="p-3">Motivo</th><th className="p-3">Risco</th><th className="p-3"><span className="sr-only">Ação</span></th></tr></thead>
        <tbody className="divide-y">{sortByAttention(items).map(item => <tr key={item.id} className="hover:bg-muted/30"><td className="p-3"><ProcessSummary item={item} /></td><td className="p-3"><p className="font-medium">{item.intelligence ? PHASE_LABELS[item.intelligence.phase] : "Não analisada"}</p><p className="mt-0.5 text-xs capitalize text-muted-foreground">{item.intelligence?.stage.replaceAll("_", " ") ?? "—"}</p></td><td className="p-3">{item.intelligence ? WAITING_LABELS[item.intelligence.waitingOn] : "—"}</td><td className="p-3">{item.intelligence?.lastAdvanceAt ? `${item.intelligence.stalledDays} dias` : "Sem histórico"}</td><td className="max-w-[260px] truncate p-3" title={item.intelligence?.waitingReason ?? ""}>{item.intelligence?.waitingReason || "—"}</td><td className="p-3"><RiskBadge item={item} /></td><td className="p-3"><Button variant="ghost" size="icon" aria-label={`Abrir processo ${item.number}`} onClick={() => navigate(`/processos/${item.id}`)}><ArrowRight className="h-4 w-4" /></Button></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Empty() { return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed text-center"><Scale className="h-9 w-9 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhum processo neste recorte</p><p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou cadastre um novo processo.</p></div>; }

export function CorrectionDialog({ item, open, busy, onOpenChange, onSubmit }: { item: ProcessIntelligenceItem | null; open: boolean; busy: boolean; onOpenChange: (open: boolean) => void; onSubmit: (correction: ProcessIntelligenceManualOverride, justification: string) => void }) {
  const intelligence = item?.intelligence;
  const [phase, setPhase] = useState<ProcessPhase>(intelligence?.phase ?? "nao_identificada");
  const [waitingOn, setWaitingOn] = useState<WaitingOn>(intelligence?.waitingOn ?? "nao_identificado");
  const [reason, setReason] = useState(intelligence?.waitingReason ?? "");
  const [nextAction, setNextAction] = useState(intelligence?.nextAction ?? "");
  const [justification, setJustification] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Corrigir leitura processual</DialogTitle><DialogDescription>Sua revisão prevalece sobre a automação e fica registrada no histórico.</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Fase</Label><Select value={phase} onValueChange={value => setPhase(value as ProcessPhase)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PHASE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Quem precisa agir</Label><Select value={waitingOn} onValueChange={value => setWaitingOn(value as WaitingOn)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WAITING_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="space-y-2"><Label>Por que não anda</Label><Textarea value={reason} onChange={event => setReason(event.target.value)} /></div><div className="space-y-2"><Label>Próxima ação</Label><Input value={nextAction} onChange={event => setNextAction(event.target.value)} /></div><div className="space-y-2"><Label>Justificativa da correção *</Label><Textarea value={justification} onChange={event => setJustification(event.target.value)} placeholder="Ex.: conferido no despacho de 12/08" /></div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={busy || justification.trim().length < 3} onClick={() => onSubmit({ phase, waitingOn, waitingReason: reason || null, nextAction: nextAction || null }, justification.trim())}>{busy ? "Salvando..." : "Salvar correção"}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

export function IntelligenceMetricCards({ total, stalled, office, critical, pending }: { total: number; stalled: number; office: number; critical: number; pending: number }) {
  const cards = [
    { label: "Processos acompanhados", value: total, icon: Scale, tone: "text-primary" },
    { label: "Sem avanço", value: stalled, icon: Clock3, tone: "text-amber-600" },
    { label: "Ação do escritório", value: office, icon: AlertTriangle, tone: "text-orange-600" },
    { label: "Risco crítico", value: critical, icon: Sparkles, tone: "text-red-600" },
    { label: "Aguardando análise", value: pending, icon: CheckCircle2, tone: "text-muted-foreground" },
  ];
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{cards.map(card => <Card key={card.label}><CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle><card.icon className={`h-4 w-4 ${card.tone}`} /></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{card.value}</p></CardContent></Card>)}</div>;
}
