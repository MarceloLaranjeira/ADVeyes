import { Badge } from "@/components/ui/badge";
import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";

export function AudienciasTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Audiências" empty="Nenhuma audiência encontrada para estes filtros." columns={[
    { label: "Audiência", render: row => <div><p className="font-medium">{text(row, "tipo")}</p><p className="text-xs text-muted-foreground">{text(row, "local", "Local não informado")}</p></div> },
    { label: "Processo", render: row => text(row, "processo_numero") },
    { label: "Data", render: row => date(row, "data_hora") },
    { label: "Status", render: row => <Badge variant="outline">{text(row, "status")}</Badge> },
  ]} />;
}
