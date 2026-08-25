import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TabPage, TabRow } from "@/services/controladoria-tabs";

export interface DomainTabProps {
  data: TabPage | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onPage: (page: number) => void;
  actions?: (row: TabRow) => React.ReactNode;
  /** Ação da aba inteira, acima da tabela — não depende de nenhuma linha. */
  toolbar?: React.ReactNode;
}

export interface DomainColumn {
  label: string;
  render: (row: TabRow) => React.ReactNode;
}

export function text(row: TabRow, key: string, fallback = "—"): string {
  const value = row[key];
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

export function date(row: TabRow, key: string): string {
  const value = row[key];
  if (!value) return "—";
  const parsed = new Date(String(value).length === 10 ? `${String(value)}T12:00:00` : String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: String(value).length > 10 ? "short" : undefined });
}

export function DomainTab({ title, empty, columns, ...props }: DomainTabProps & {
  title: string;
  empty: string;
  columns: DomainColumn[];
}): JSX.Element {
  const pages = Math.max(1, Math.ceil((props.data?.total ?? 0) / (props.data?.pageSize ?? 20)));
  return (
    <Card>
      <CardContent className="p-0">
        {props.toolbar && <div className="flex justify-end border-b px-4 py-3">{props.toolbar}</div>}
        {props.loading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando {title.toLowerCase()}...</p> : props.error ? <div className="p-8 text-center"><p className="text-sm font-medium">Não foi possível carregar {title.toLowerCase()}.</p><Button variant="outline" className="mt-3" onClick={props.onRetry}>Tentar novamente</Button></div> : !props.data?.rows.length ? <p className="p-8 text-center text-sm text-muted-foreground">{empty}</p> : <>
          <Table>
            <TableHeader><TableRow>{columns.map(column => <TableHead key={column.label}>{column.label}</TableHead>)}{props.actions && <TableHead className="text-right">Ações</TableHead>}</TableRow></TableHeader>
            <TableBody>{props.data.rows.map(row => <TableRow key={row.id}>{columns.map(column => <TableCell key={column.label}>{column.render(row)}</TableCell>)}{props.actions && <TableCell className="text-right">{props.actions(row)}</TableCell>}</TableRow>)}</TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>{props.data.total} registros · página {props.data.page} de {pages}</span>
            <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={props.data.page <= 1} onClick={() => props.onPage(props.data!.page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próxima página" disabled={props.data.page >= pages} onClick={() => props.onPage(props.data!.page + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        </>}
      </CardContent>
    </Card>
  );
}
