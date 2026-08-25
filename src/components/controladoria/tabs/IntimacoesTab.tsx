import { Badge } from "@/components/ui/badge";
import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";

export function IntimacoesTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Intimações" empty="Nenhuma intimação encontrada para estes filtros." columns={[
    { label: "Intimação", render: row => <div><p className="font-medium">{text(row, "tipo", "Intimação")}</p><p className="text-xs text-muted-foreground">{text(row, "cliente_nome", "Cliente não informado")}</p></div> },
    { label: "Processo", render: row => text(row, "numero_processo") },
    { label: "Publicação", render: row => date(row, "data_publicacao") },
    { label: "Ciência", render: row => <Badge variant="outline">{row.ciencia_em ? date(row, "ciencia_em") : "Sem ciência"}</Badge> },
  ]} />;
}
