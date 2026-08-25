import { Badge } from "@/components/ui/badge";
import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";

export function PrazosTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Prazos" empty="Nenhum prazo encontrado para estes filtros." columns={[
    { label: "Prazo", render: row => <div><p className="font-medium">{text(row, "titulo")}</p><p className="text-xs text-muted-foreground">{text(row, "processo_id", "Sem processo")}</p></div> },
    { label: "Data", render: row => date(row, "data_limite") },
    { label: "Status", render: row => <Badge variant="outline">{text(row, "status")}</Badge> },
    { label: "Responsável", render: row => text(row, "responsavel_id", "Sem responsável") },
  ]} />;
}
