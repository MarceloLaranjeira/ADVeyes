import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { summarizeContacts, type InsightContact, type InsightProcess } from "@/lib/contact-insights";

const PALETTE = [
  "hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))",
  "hsl(var(--warning))", "hsl(var(--accent))", "hsl(var(--destructive))",
];

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Donut({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  const visible = data.filter((item) => item.value > 0);
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <div className="h-44" role="img" aria-label={title}>
          {visible.length === 0 ? (
            <p className="h-full flex items-center justify-center text-xs text-muted-foreground text-center">
              Sem dados. Preencha o cadastro dos contatos.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={visible} dataKey="value" nameKey="name" innerRadius={38} outerRadius={68} paddingAngle={2}>
                  {visible.map((item, index) => <Cell key={item.name} fill={PALETTE[index % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ContactInsights({ contacts, processes }: { contacts: InsightContact[]; processes: InsightProcess[] }) {
  const insights = useMemo(() => summarizeContacts(contacts, processes), [contacts, processes]);
  const change = insights.monthChangePct;
  const hint = `+${insights.createdThisMonth} no mês${change === null ? "" : ` (${change > 0 ? "+" : ""}${change}% sobre o mês anterior)`}`;

  return (
    <section aria-label="Indicadores de contatos" className="space-y-4 mb-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Contatos cadastrados" value={insights.total} hint={hint} />
        <Stat label="Com processo ativo" value={insights.withActiveProcess} />
        <Stat label="Sem processo ativo" value={insights.withoutActiveProcess} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Top origens</h3>
            <div className="h-44" role="img" aria-label="Top origens dos contatos">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topOrigins}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" name="Contatos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Donut title="Faixa etária" data={insights.ageBuckets} />
        <Donut title="Top profissões" data={insights.topProfessions} />
      </div>
      {insights.birthdaysThisMonth.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Aniversariantes do mês ({insights.birthdaysThisMonth.length})</h3>
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {insights.birthdaysThisMonth.slice(0, 12).map((person) => (
                <li key={person.id}><span className="tabular-nums text-muted-foreground">{String(person.day).padStart(2, "0")}</span> {person.nome}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
