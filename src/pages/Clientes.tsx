import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Plus, Phone, Mail, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const clientes = [
  { id: "1", nome: "João Silva", cpf: "123.456.789-00", telefone: "(92) 99999-1111", email: "joao@email.com", processos: 3, area: "Penal" },
  { id: "2", nome: "Maria Santos", cpf: "234.567.890-11", telefone: "(92) 99999-2222", email: "maria@email.com", processos: 1, area: "Família" },
  { id: "3", nome: "Carlos Oliveira", cpf: "345.678.901-22", telefone: "(92) 99999-3333", email: "carlos@email.com", processos: 2, area: "Cível" },
  { id: "4", nome: "Ana Costa", cpf: "456.789.012-33", telefone: "(92) 99999-4444", email: "ana@email.com", processos: 2, area: "Execução Penal" },
  { id: "5", nome: "Pedro Lima", cpf: "567.890.123-44", telefone: "(92) 99999-5555", email: "pedro@email.com", processos: 1, area: "Recurso" },
  { id: "6", nome: "Lucia Ferreira", cpf: "678.901.234-55", telefone: "(92) 99999-6666", email: "lucia@email.com", processos: 1, area: "Penal" },
];

const Clientes = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif">Clientes</h1>
            <p className="text-muted-foreground text-sm mt-1">Cadastro e gestão de clientes</p>
          </div>
          <Button className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente por nome ou CPF..." className="pl-10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clientes.map((c) => (
            <div key={c.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{c.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">CPF: {c.cpf}</p>
                </div>
                <button className="p-1 hover:bg-muted rounded">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" />
                  {c.telefone}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  {c.email}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.processos} processo(s) ativo(s)</span>
                <span className="text-xs font-medium text-primary">{c.area}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Clientes;
