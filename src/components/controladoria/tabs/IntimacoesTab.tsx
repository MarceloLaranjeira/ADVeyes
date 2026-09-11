import { Badge } from "@/components/ui/badge";
import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";
import { classifyDeadline, formatDeadlineDate } from "@/lib/controladoria";

export function IntimacoesTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Intimações" empty="Nenhuma intimação encontrada para estes filtros." columns={[
    { label: "Intimação", render: row => <div><p className="font-medium">{text(row, "tipo", "Intimação")}</p><p className="text-xs text-muted-foreground">{text(row, "cliente_nome", "Cliente não informado")}</p></div> },
    { label: "Processo", render: row => text(row, "numero_processo") },
    { label: "Publicação", render: row => date(row, "data_publicacao") },
    { label: "Prazo final", render: row => { const value = row.data_prazo ? String(row.data_prazo) : null; const deadline = classifyDeadline(value, new Date()); return <div><p>{formatDeadlineDate(value)}</p>{value ? <p className={deadline.urgency === "vencido" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{deadline.label}</p> : null}</div>; } },
    { label: "Ciência", render: row => <Badge variant="outline">{row.ciencia_em ? date(row, "ciencia_em") : "Sem ciência"}</Badge> },
  ]} />;
}
