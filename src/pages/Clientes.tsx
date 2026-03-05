import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Plus, Phone, Mail, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ClienteForm } from "@/components/clientes/ClienteForm";

const Clientes = () => {
  const [clientes, setClientes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchClientes = async () => {
    const { data } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
    if (data) setClientes(data);
  };

  useEffect(() => { fetchClientes(); }, []);

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.cpf || "").includes(search)
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif">Clientes</h1>
            <p className="text-muted-foreground text-sm mt-1">Cadastro e gestão de clientes</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Cliente
          </Button>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente por nome ou CPF..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum cliente encontrado</div>
          )}
          {filtered.map((c) => (
            <div key={c.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{c.nome}</h3>
                  {c.cpf && <p className="text-xs text-muted-foreground mt-0.5">CPF: {c.cpf}</p>}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {c.telefone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {c.telefone}
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {c.email}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <ClienteForm open={showForm} onOpenChange={setShowForm} onSuccess={fetchClientes} />
      </div>
    </AppLayout>
  );
};

export default Clientes;
