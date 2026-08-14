import { ArrowRight, Clock3, Loader2, ShieldAlert, UserRoundCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProcessIntelligence } from "@/hooks/useProcessIntelligence";
import { intelligenceMetrics } from "@/lib/process-intelligence-workspace";

export function ProcessIntelligenceHomeCards({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const query = useProcessIntelligence(tenantId);
  const metrics = intelligenceMetrics(query.items);
  const cards = [
    { label: "Processos sem avanço", value: metrics.stalled, detail: "Acima do tempo esperado", icon: Clock3, filter: "stalled", tone: "text-amber-600 bg-amber-50" },
    { label: "Dependem do escritório", value: metrics.office, detail: "Precisam de ação interna", icon: UserRoundCheck, filter: "office", tone: "text-orange-600 bg-orange-50" },
    { label: "Risco crítico", value: metrics.critical, detail: "Exigem prioridade imediata", icon: ShieldAlert, filter: "critical", tone: "text-red-600 bg-red-50" },
  ];
  return (
    <Card><CardContent className="p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-serif text-lg font-semibold">Inteligência processual</h2><p className="mt-1 text-xs text-muted-foreground">Onde a carteira precisa de atenção agora</p></div><Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate("/processos")}>Abrir central <ArrowRight className="h-3.5 w-3.5" /></Button></div>
      {query.loading ? <div className="flex min-h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : <div className="grid gap-3 sm:grid-cols-3">{cards.map(card => <button type="button" key={card.label} onClick={() => navigate(`/processos?focus=${card.filter}`)} className="rounded-xl border p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={`inline-flex rounded-lg p-2 ${card.tone}`}><card.icon className="h-4 w-4" /></span><strong className="mt-3 block text-2xl">{card.value}</strong><span className="mt-1 block text-xs font-semibold">{card.label}</span><span className="mt-1 block text-[11px] text-muted-foreground">{card.detail}</span></button>)}</div>}
    </CardContent></Card>
  );
}
