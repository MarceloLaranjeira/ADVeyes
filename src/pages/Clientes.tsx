import { useCallback, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Plus, Phone, Mail, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/contexts/TenantContext";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];

const relationshipLabels: Record<string, string> = {
  cliente: "Cliente",
  parte_contraria: "Parte contrária",
  terceiro: "Terceiro",
};

const personTypeLabels: Record<string, string> = {
  pessoa_fisica: "Pessoa física",
  pessoa_juridica: "Pessoa jurídica",
  orgao_publico: "Órgão público",
  desconhecido: "Tipo não informado",
};

interface ContactEnrichmentMetadata {
  status?: "completed" | "not_found" | "retry" | "failed";
  provider?: "brasilapi" | "opencnpj" | "serpro";
  checked_at?: string;
  fields?: string[];
}

function enrichmentMetadata(cliente: Cliente): ContactEnrichmentMetadata | null {
  const metadata = cliente.source_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const enrichment = (metadata as Record<string, unknown>).contact_enrichment;
  return enrichment && typeof enrichment === "object" && !Array.isArray(enrichment)
    ? enrichment as ContactEnrichmentMetadata
    : null;
}

function hasFullCnpj(value: string | null): boolean {
  const normalized = value?.toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
  return /^[0-9A-Z]{12}[0-9]{2}$/.test(normalized);
}

function enrichmentLabel(cliente: Cliente): string {
  const enrichment = enrichmentMetadata(cliente);
  if (!enrichment) {
    return hasFullCnpj(cliente.cpf)
      ? "Aguardando enriquecimento empresarial"
      : "CNPJ não disponibilizado pela capa";
  }
  if (enrichment.status === "completed") {
    const provider = enrichment.provider === "opencnpj"
      ? "OpenCNPJ"
      : enrichment.provider === "serpro" ? "SERPRO" : "BrasilAPI";
    return enrichment.fields?.length
      ? `Enriquecido por ${provider}`
      : `Cadastro consultado em ${provider}, sem novos meios de contato`;
  }
  if (enrichment.status === "not_found") return "CNPJ não localizado nas fontes públicas";
  if (enrichment.status === "retry") return "Consulta pública em retentativa automática";
  return "Enriquecimento público indisponível";
}

const Clientes = () => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [searchParams] = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Record<string, any> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    if (!currentTenant) return;
    const { data } = await supabase.from("clientes").select("*")
      .eq("tenant_id", currentTenant.tenantId)
      .order("created_at", { ascending: false });
    if (data) setClientes(data);
  }, [currentTenant]);

  useEffect(() => { void fetchClientes(); }, [fetchClientes]);
  useEffect(() => { setSearch(searchParams.get("q") ?? ""); }, [searchParams]);

  const handleDelete = async () => {
    if (!deleteId) return;
    if (!currentTenant) return;
    const { error } = await supabase.from("clientes").delete()
      .eq("tenant_id", currentTenant.tenantId).eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cliente excluído!" });
      fetchClientes();
    }
    setDeleteId(null);
  };

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.cpf || "").includes(search) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.telefone || "").includes(search)
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Clientes</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Clientes, partes contrárias e terceiros vinculados aos processos
            </p>
          </div>
          <Button onClick={() => { setEditData(null); setShowForm(true); }} className="gap-2">
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
            <div key={c.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{c.nome}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={c.relationship_type === "cliente" ? "default" : "secondary"}>
                      {relationshipLabels[c.relationship_type] ?? c.relationship_type}
                    </Badge>
                    {c.person_type && (
                      <Badge variant="outline">
                        {personTypeLabels[c.person_type] ?? c.person_type}
                      </Badge>
                    )}
                  </div>
                  {c.cpf && <p className="text-xs text-muted-foreground mt-0.5">CPF/CNPJ: {c.cpf}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditData(c); setShowForm(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
                {c.endereco && (
                  <p className="text-sm text-muted-foreground">{c.endereco}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                  <span>
                    Origem: {c.source_provider === "manual" ? "Cadastro manual" : c.source_provider.toUpperCase()}
                  </span>
                  <span>
                    {Array.isArray((c.source_metadata as { process_ids?: unknown[] } | null)?.process_ids)
                      ? (c.source_metadata as { process_ids: unknown[] }).process_ids.length
                      : 0} processo(s) relacionado(s)
                  </span>
                </div>
                <div className="pt-1 text-xs text-muted-foreground">
                  <span>{enrichmentLabel(c)}</span>
                  {enrichmentMetadata(c)?.checked_at && (
                    <span>
                      {` · consultado em ${new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(enrichmentMetadata(c)!.checked_at!))}`}
                    </span>
                  )}
                </div>
                {!c.telefone && !c.email && !c.endereco && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <p className="text-xs text-muted-foreground italic">
                      {hasFullCnpj(c.cpf)
                        ? "O cadastro empresarial público ainda não forneceu telefone, e-mail ou endereço."
                        : "Dados de contato não disponibilizados pela capa pública."}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary font-medium hover:bg-primary/10"
                      onClick={() => { setEditData(c); setShowForm(true); }}
                    >
                      <Pencil className="mr-1.5 h-3 w-3" /> Adicionar contato
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <ClienteForm open={showForm} onOpenChange={setShowForm} onSuccess={fetchClientes} editData={editData} />

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. O cliente será removido permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Clientes;
