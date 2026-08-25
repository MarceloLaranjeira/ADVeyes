import { DomainTab, date, text, type DomainTabProps } from "./DomainTab";

export function MovimentacoesTab(props: DomainTabProps): JSX.Element {
  return <DomainTab {...props} title="Movimentações" empty="Nenhuma movimentação encontrada para estes filtros." columns={[
    { label: "Movimentação", render: row => <div className="max-w-xl"><p className="font-medium">{text(row, "title", text(row, "movement_type"))}</p><p className="line-clamp-2 text-xs text-muted-foreground">{text(row, "content")}</p></div> },
    { label: "Processo", render: row => text(row, "process_number") },
    { label: "Ocorrência", render: row => date(row, "occurred_at") },
    { label: "Origem", render: row => text(row, "provider") },
  ]} />;
}
