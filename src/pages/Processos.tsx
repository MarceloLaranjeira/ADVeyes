import { AppLayout } from "@/components/layout/AppLayout";
import { AreaBadge } from "@/components/common/AreaBadge";
import { Search, Plus, Filter, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const processos = [
  { id: "1", numero: "0001234-56.2024.8.04.0001", cliente: "João Silva", area: "Penal", status: "Em andamento", vara: "1ª Vara Criminal", advogado: "Dr. Albertino", atualizado: "04/03/2026" },
  { id: "2", numero: "0002345-67.2024.8.04.0001", cliente: "Maria Santos", area: "Família", status: "Aguardando audiência", vara: "2ª Vara de Família", advogado: "Dra. Camila", atualizado: "03/03/2026" },
  { id: "3", numero: "0003456-78.2024.8.04.0001", cliente: "Carlos Oliveira", area: "Cível", status: "Sentença proferida", vara: "3ª Vara Cível", advogado: "Dr. Roberto", atualizado: "02/03/2026" },
  { id: "4", numero: "0004567-89.2024.8.04.0001", cliente: "Ana Costa", area: "Execução Penal", status: "Recurso interposto", vara: "Vara de Execuções Penais", advogado: "Dr. Albertino", atualizado: "01/03/2026" },
  { id: "5", numero: "0005678-90.2024.8.04.0001", cliente: "Pedro Lima", area: "Recurso", status: "Distribuído ao relator", vara: "2ª Câmara Criminal - TJAM", advogado: "Dr. Albertino", atualizado: "28/02/2026" },
  { id: "6", numero: "0006789-01.2024.8.04.0001", cliente: "Lucia Ferreira", area: "Penal", status: "Instrução processual", vara: "2ª Vara Criminal", advogado: "Dra. Camila", atualizado: "27/02/2026" },
  { id: "7", numero: "0007890-12.2024.8.04.0001", cliente: "Roberto Souza", area: "Penal", status: "Julgamento marcado", vara: "Tribunal do Júri", advogado: "Dr. Albertino", atualizado: "26/02/2026" },
  { id: "8", numero: "0008901-23.2024.8.04.0001", cliente: "Fernanda Dias", area: "Família", status: "Conciliação agendada", vara: "1ª Vara de Família", advogado: "Dr. Roberto", atualizado: "25/02/2026" },
];

const Processos = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif">Processos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerenciamento de todos os processos do escritório</p>
          </div>
          <Button className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" />
            Novo Processo
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por número, cliente ou área..." className="pl-10" />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Número</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Área</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vara/Câmara</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Advogado</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Atualizado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {processos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="p-4 text-sm font-mono">{p.numero}</td>
                  <td className="p-4 text-sm font-medium">{p.cliente}</td>
                  <td className="p-4"><AreaBadge area={p.area} /></td>
                  <td className="p-4 text-sm text-muted-foreground">{p.vara}</td>
                  <td className="p-4 text-sm">{p.status}</td>
                  <td className="p-4 text-sm text-muted-foreground">{p.advogado}</td>
                  <td className="p-4 text-sm text-muted-foreground">{p.atualizado}</td>
                  <td className="p-4">
                    <button className="p-1 hover:bg-muted rounded">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default Processos;
