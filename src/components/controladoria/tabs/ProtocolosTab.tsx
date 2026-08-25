import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";

export function ProtocolosTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Protocolos" empty="Nenhum protocolo registrado neste período." columns={[
    { label: "Ato", render: row => <div><p className="font-medium">{text(row, "tipo")}</p><p className="text-xs text-muted-foreground">{text(row, "descricao", "Sem descrição")}</p></div> },
    { label: "Processo", render: row => text(row, "numero_processo") },
    { label: "Protocolo", render: row => text(row, "protocolo_numero") },
    { label: "Registrado em", render: row => date(row, "protocolado_em") },
  ]} />;
}
