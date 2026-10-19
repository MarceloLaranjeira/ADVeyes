import { useCallback, useEffect, useMemo, useState } from "react";
import { ListTodo, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { taskWorkflowsService } from "@/services/task-workflows";
import type { TaskType, TaskWorkflow, TaskWorkflowStepInput } from "@/types/task-workflows";

interface Props {
  tenantId: string;
  canManage: boolean;
}

const emptyType = { nome: "", categoria: "", pontos: "0", prazo: "" };

export function TaskWorkflowSettings({ tenantId, canManage }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [types, setTypes] = useState<TaskType[]>([]);
  const [workflows, setWorkflows] = useState<TaskWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [offsetDays, setOffsetDays] = useState("0");
  const [steps, setSteps] = useState<TaskWorkflowStepInput[]>([]);

  const activeTypes = useMemo(() => types.filter((type) => type.ativo), [types]);
  const typeById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const [nextTypes, nextWorkflows] = await Promise.all([
        taskWorkflowsService.listTypes(tenantId),
        taskWorkflowsService.listWorkflows(tenantId),
      ]);
      setTypes(nextTypes);
      setWorkflows(nextWorkflows);
    } catch (error) {
      toast({ title: "Não foi possível carregar os workflows", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [canManage, tenantId, toast]);

  useEffect(() => { void load(); }, [load]);

  const createType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !typeForm.nome.trim()) return;
    setWorking(true);
    try {
      await taskWorkflowsService.createType(tenantId, user.id, {
        nome: typeForm.nome.trim(),
        categoria: typeForm.categoria.trim() || null,
        pontos: Math.max(0, Number.parseInt(typeForm.pontos, 10) || 0),
        prazo_padrao_dias: typeForm.prazo === "" ? null : Math.max(0, Number.parseInt(typeForm.prazo, 10) || 0),
      });
      setTypeForm(emptyType);
      await load();
      toast({ title: "Tipo de tarefa criado" });
    } catch (error) {
      toast({ title: "Não foi possível criar o tipo", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const toggleType = async (type: TaskType) => {
    setWorking(true);
    try {
      await taskWorkflowsService.setTypeActive(tenantId, type.id, !type.ativo);
      await load();
    } catch (error) {
      toast({ title: "Não foi possível atualizar o tipo", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const addStep = () => {
    if (!selectedTypeId || steps.some((step) => step.tipoTarefaId === selectedTypeId)) return;
    setSteps((current) => [...current, { tipoTarefaId: selectedTypeId, prazoOffsetDias: Math.max(0, Number.parseInt(offsetDays, 10) || 0) }]);
    setSelectedTypeId("");
    setOffsetDays("0");
  };

  const createWorkflow = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workflowName.trim() || steps.length === 0) return;
    setWorking(true);
    try {
      await taskWorkflowsService.createWorkflow(tenantId, workflowName.trim(), workflowDescription.trim() || null, steps);
      setWorkflowName("");
      setWorkflowDescription("");
      setSteps([]);
      await load();
      toast({ title: "Workflow criado" });
    } catch (error) {
      toast({ title: "Não foi possível criar o workflow", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const toggleWorkflow = async (workflow: TaskWorkflow) => {
    setWorking(true);
    try {
      await taskWorkflowsService.setWorkflowActive(tenantId, workflow.id, !workflow.ativo);
      await load();
    } catch (error) {
      toast({ title: "Não foi possível atualizar o workflow", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  if (!canManage) return <Card className="border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary-100)/0.3)]"><CardContent className="p-6 text-sm text-muted-foreground">Apenas proprietários e administradores podem configurar tipos e workflows.</CardContent></Card>;

  return <div className="space-y-4">
    <Card className="overflow-hidden border-[hsl(var(--primary)/0.24)] shadow-[0_16px_32px_-26px_hsl(var(--primary)/0.62)]">
      <CardHeader className="border-b border-[hsl(var(--primary)/0.16)] bg-gradient-to-r from-[hsl(var(--primary-100)/0.88)] via-card to-card pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base text-[hsl(var(--primary-900))]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm"><ListTodo className="h-4 w-4" /></span> Tipos de tarefa</CardTitle><p className="mt-2 text-xs text-muted-foreground">Padronize nome, categoria, pontos e prazo interno em dias corridos.</p></div><Button size="icon" variant="ghost" className="text-primary hover:bg-[hsl(var(--primary)/0.1)] hover:text-[hsl(var(--primary-900))]" onClick={() => void load()} disabled={loading || working} aria-label="Atualizar tipos"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></div></CardHeader>
      <CardContent className="space-y-4 p-5"><form onSubmit={createType} className="grid gap-3 rounded-xl border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary-100)/0.35)] p-3 md:grid-cols-5"><Input required value={typeForm.nome} onChange={(event) => setTypeForm({ ...typeForm, nome: event.target.value })} placeholder="Nome da tarefa" aria-label="Nome do tipo de tarefa" /><Input value={typeForm.categoria} onChange={(event) => setTypeForm({ ...typeForm, categoria: event.target.value })} placeholder="Categoria" aria-label="Categoria" /><Input type="number" min="0" value={typeForm.pontos} onChange={(event) => setTypeForm({ ...typeForm, pontos: event.target.value })} placeholder="Pontos" aria-label="Pontos" /><Input type="number" min="0" value={typeForm.prazo} onChange={(event) => setTypeForm({ ...typeForm, prazo: event.target.value })} placeholder="Prazo em dias" aria-label="Prazo em dias corridos" /><Button type="submit" disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Adicionar</>}</Button></form>
        <div className="divide-y divide-[hsl(var(--primary)/0.12)] rounded-xl border border-[hsl(var(--primary)/0.16)]">{types.map((type) => <div key={type.id} className="flex items-center justify-between gap-3 p-3 text-sm transition-colors hover:bg-[hsl(var(--primary-100)/0.32)]"><div><p className="font-semibold text-[hsl(var(--primary-900))]">{type.nome}</p><p className="text-xs text-muted-foreground">{type.categoria ?? "Sem categoria"} · {type.pontos} pontos{type.prazo_padrao_dias !== null ? ` · ${type.prazo_padrao_dias} dia(s)` : ""}</p></div><Switch checked={type.ativo} onCheckedChange={() => void toggleType(type)} disabled={working} aria-label={`Ativar ${type.nome}`} /></div>)}{!loading && types.length === 0 ? <p className="p-5 text-center text-sm text-muted-foreground">Crie o primeiro tipo para montar um workflow.</p> : null}</div>
      </CardContent>
    </Card>

    <Card className="overflow-hidden border-[hsl(var(--primary)/0.24)] shadow-[0_16px_32px_-26px_hsl(var(--primary)/0.62)]">
      <CardHeader className="border-b border-[hsl(var(--primary)/0.16)] bg-gradient-to-r from-[hsl(var(--primary-900))] to-[hsl(var(--primary))] pb-3"><div><CardTitle className="text-base text-primary-foreground">Workflows de tarefas</CardTitle><p className="mt-1 text-xs text-primary-foreground/80">Cada etapa cria uma atividade interna; prazos jurídicos continuam na Controladoria.</p></div></CardHeader>
      <CardContent className="space-y-4 p-5"><form className="space-y-3 rounded-xl border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary-100)/0.35)] p-3" onSubmit={createWorkflow}><div className="grid gap-3 md:grid-cols-2"><div className="space-y-1"><Label htmlFor="workflow-name">Nome do workflow</Label><Input id="workflow-name" required value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} placeholder="Ex.: Abertura de processo" /></div><div className="space-y-1"><Label htmlFor="workflow-description">Descrição</Label><Input id="workflow-description" value={workflowDescription} onChange={(event) => setWorkflowDescription(event.target.value)} placeholder="Opcional" /></div></div>
        <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]"><Select value={selectedTypeId} onValueChange={setSelectedTypeId}><SelectTrigger><SelectValue placeholder="Tipo de tarefa" /></SelectTrigger><SelectContent>{activeTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.nome}</SelectItem>)}</SelectContent></Select><Input type="number" min="0" value={offsetDays} onChange={(event) => setOffsetDays(event.target.value)} aria-label="Dias após o início" placeholder="Dias após início" /><Button type="button" variant="outline" className="border-[hsl(var(--primary)/0.35)] text-primary hover:bg-[hsl(var(--primary)/0.1)]" onClick={addStep} disabled={!selectedTypeId || working}>Adicionar etapa</Button></div>
        {steps.length ? <div className="space-y-1 rounded-lg border border-[hsl(var(--primary)/0.18)] bg-card p-2">{steps.map((step, index) => <div key={step.tipoTarefaId} className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-[hsl(var(--primary-900))]">{index + 1}. {typeById.get(step.tipoTarefaId)?.nome ?? "Tipo removido"}</span><button type="button" className="text-xs text-destructive" onClick={() => setSteps((current) => current.filter((item) => item.tipoTarefaId !== step.tipoTarefaId))}>Remover</button><span className="text-xs text-muted-foreground">+{step.prazoOffsetDias} dia(s)</span></div>)}</div> : <p className="text-xs text-muted-foreground">Adicione ao menos uma etapa ativa.</p>}
        <Button type="submit" disabled={working || steps.length === 0}>{working ? "Salvando..." : "Criar workflow"}</Button></form>
        <div className="space-y-2">{workflows.map((workflow) => <div key={workflow.id} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--primary)/0.16)] p-3 transition-colors hover:bg-[hsl(var(--primary-100)/0.32)]"><div><p className="font-semibold text-[hsl(var(--primary-900))]">{workflow.nome}</p><p className="text-xs text-muted-foreground">{workflow.steps.map((step) => typeById.get(step.tipo_tarefa_id)?.nome ?? "Tipo indisponível").join(" → ") || "Sem etapas"}</p></div><Switch checked={workflow.ativo} onCheckedChange={() => void toggleWorkflow(workflow)} disabled={working} aria-label={`Ativar ${workflow.nome}`} /></div>)}{!loading && workflows.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Nenhum workflow configurado.</p> : null}</div>
      </CardContent>
    </Card>
  </div>;
}
