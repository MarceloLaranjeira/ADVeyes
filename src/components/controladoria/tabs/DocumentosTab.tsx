import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";

export function DocumentosTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Documentos" empty="Nenhum documento encontrado para estes filtros." columns={[
    { label: "Documento", render: row => <div><p className="font-medium">{text(row, "nome")}</p><p className="text-xs text-muted-foreground">{text(row, "tipo")}</p></div> },
    { label: "Processo", render: row => text(row, "processo_numero") },
    { label: "Protocolo", render: row => text(row, "protocolo_id", "Não vinculado") },
    { label: "Criado em", render: row => date(row, "created_at") },
  ]} />;
}
