import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { officeService, type CatalogItem, type CatalogKind } from "@/services/office";

interface Props {
  tenantId: string;
  canManage: boolean;
  tipo: CatalogKind;
  title: string;
  description: string;
  /** Rótulo do campo numérico opcional (por exemplo, pontos da meta). */
  valueLabel?: string;
}

export function CatalogSettings({ tenantId, canManage, tipo, title, description, valueLabel }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const report = useCallback((error: unknown, action: string) => {
    toast({ title: `Não foi possível ${action}`, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await officeService.listCatalog(tenantId, tipo));
    } catch (error) {
      report(error, "carregar a lista");
    } finally {
      setLoading(false);
    }
  }, [report, tenantId, tipo]);

  useEffect(() => { void load(); }, [load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    try {
      await officeService.createCatalogItem(tenantId, user.id, tipo, name, valueLabel && value ? Number(value) : null);
      setName("");
      setValue("");
      await load();
    } catch (error) {
      report(error, "adicionar o item");
      setLoading(false);
    }
  };

  const toggle = async (item: CatalogItem, ativo: boolean) => {
    try {
      await officeService.setCatalogActive(tenantId, item.id, ativo);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ativo } : entry)));
    } catch (error) {
      report(error, "atualizar o item");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <form onSubmit={add} className="flex flex-wrap gap-2">
            <Input aria-label={`Novo item de ${title}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" maxLength={160} className="flex-1 min-w-48" />
            {valueLabel && (
              <Input aria-label={valueLabel} type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder={valueLabel} className="w-36" />
            )}
            <Button type="submit" size="sm" disabled={loading || !name.trim()} className="gap-1">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Adicionar
            </Button>
          </form>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{loading ? "Carregando..." : "Nenhum item cadastrado."}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className={item.ativo ? "" : "text-muted-foreground line-through"}>
                  {item.nome}{item.valor !== null && valueLabel ? ` · ${item.valor}` : ""}
                </span>
                <Switch checked={item.ativo} disabled={!canManage} onCheckedChange={(checked) => void toggle(item, checked)} aria-label={`Ativar ${item.nome}`} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
