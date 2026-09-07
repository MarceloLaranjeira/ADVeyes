import { Badge } from "@/components/ui/badge";
import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";
import { classifyDeadline, formatDeadlineDate } from "@/lib/controladoria";

function deadline(row: Record<string, unknown>): JSX.Element {
  const value = row.data_limite ? String(row.data_limite) : null;
  const state = classifyDeadline(value, new Date());
  return <div><p className="font-medium">{formatDeadlineDate(value)}</p><p className={state.urgency === "vencido" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{state.label}</p></div>;
}

export function PrazosTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Prazos" empty="Nenhum prazo encontrado para estes filtros." columns={[
    { label: "Prazo", render: row => <div><p className="font-medium">{text(row, "titulo")}</p><p className="text-xs text-muted-foreground">{text(row, "processo_id", "Sem processo")}</p></div> },
    { label: "Vencimento", render: row => deadline(row) },
    { label: "Status", render: row => <Badge variant="outline">{text(row, "status")}</Badge> },
    { label: "Responsável", render: row => text(row, "responsavel_id", "Sem responsável") },
  ]} />;
}
