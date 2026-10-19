import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  managementRows,
  personOf,
  summarizeAgility,
  type AgilityTask,
} from "@/lib/task-agility";

const SLICES = [
  { key: "onTime", label: "Concluídas em dia", color: "hsl(var(--success))" },
  { key: "late", label: "Em atraso", color: "hsl(var(--destructive))" },
  { key: "pending", label: "Pendentes", color: "hsl(var(--warning))" },
] as const;

const formatDays = (value: number | null) => (value === null ? "—" : `${value} dias`);
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";

function Ranking({ title, items }: { title: string; items: Array<{ name: string; count: number }> }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa em atraso.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.name} className="flex items-center justify-between text-sm">
              <span className="truncate pr-3">{item.name}</span>
              <span className="font-semibold tabular-nums">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AgilityPanel({ tasks }: { tasks: AgilityTask[] }) {
  const [person, setPerson] = useState<string>("");
  const summary = useMemo(() => summarizeAgility(tasks), [tasks]);
  const people = useMemo(() => [...new Set(tasks.map(personOf))].sort(), [tasks]);
  const rows = useMemo(() => managementRows(tasks, person || null), [tasks, person]);
  const chart = SLICES.map((slice) => ({ ...slice, value: summary[slice.key] }));
  const hasData = chart.some((slice) => slice.value > 0);

  return (
    <section aria-labelledby="agilidade-titulo" className="mb-8 space-y-4">
      <h2 id="agilidade-titulo" className="text-xl font-semibold font-serif">Agilidade e produtividade</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 grid gap-6 md:grid-cols-2 items-center">
            <div className="h-56" role="img" aria-label="Distribuição das tarefas por situação de prazo">
              {hasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chart} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {chart.map((slice) => <Cell key={slice.key} fill={slice.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sem tarefas para analisar.
                </p>
              )}
            </div>
            <dl className="space-y-3">
              {chart.map((slice) => (
                <div key={slice.key} className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: slice.color }} />
                    {slice.label}
                  </dt>
                  <dd className="font-semibold tabular-nums">{slice.value}</dd>
                </div>
              ))}
              <div className="border-t pt-3 flex items-center justify-between text-sm">
                <dt>Média de cumprimento</dt>
                <dd className="font-semibold">{formatDays(summary.avgDaysOnTime)}</dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt>Média de atraso</dt>
                <dd className="font-semibold">{formatDays(summary.avgDaysLate)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-5">
            <Ranking title="Tarefas com mais atrasos" items={summary.topLateTasks} />
            <Ranking title="Colaboradores com mais atrasos" items={summary.topLatePeople} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold">Gestão: tarefas concluídas</h3>
            <label className="text-sm flex items-center gap-2">
              Responsável
              <select
                value={person}
                onChange={(event) => setPerson(event.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                <option value="">Todos</option>
                {people.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Responsável</th>
                  <th className="py-2 pr-4 font-medium">Tarefa</th>
                  <th className="py-2 pr-4 font-medium text-right">Pontuação</th>
                  <th className="py-2 pr-4 font-medium">Prazo</th>
                  <th className="py-2 font-medium">Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>
                ) : rows.slice(0, 100).map((row, index) => (
                  <tr key={`${row.person}-${row.completedAt}-${index}`} className="border-t">
                    <td className="py-2 pr-4">{row.person}</td>
                    <td className="py-2 pr-4">{row.task}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.points}</td>
                    <td className="py-2 pr-4">{formatDate(row.deadline)}</td>
                    <td className="py-2">{formatDate(row.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Total: {rows.reduce((sum, row) => sum + row.points, 0)} pontos em {rows.length} tarefas
            {rows.length > 100 ? " (exibindo as 100 mais recentes)" : ""}.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
