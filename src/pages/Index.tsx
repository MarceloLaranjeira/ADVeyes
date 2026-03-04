import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentProcesses } from "@/components/dashboard/RecentProcesses";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { AreaDistribution } from "@/components/dashboard/AreaDistribution";
import { Scale, Users, CalendarDays, AlertTriangle, Gavel, FileText } from "lucide-react";

const Index = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bem-vindo ao sistema de gestão — Albertino e Advogados Associados
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard title="Processos Ativos" value={128} icon={Scale} trend={{ value: 12, positive: true }} />
          <StatCard title="Clientes" value={94} icon={Users} trend={{ value: 5, positive: true }} />
          <StatCard title="Prazos Próximos" value={8} subtitle="Próximos 7 dias" icon={CalendarDays} />
          <StatCard title="Urgentes" value={3} icon={AlertTriangle} variant="accent" />
          <StatCard title="Audiências" value={5} subtitle="Esta semana" icon={Gavel} />
          <StatCard title="Documentos" value={342} icon={FileText} trend={{ value: 8, positive: true }} />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <RecentProcesses />
          </div>
          <div className="space-y-6">
            <UpcomingDeadlines />
            <AreaDistribution />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
