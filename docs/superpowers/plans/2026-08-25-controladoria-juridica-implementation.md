# Plano de implementação: Controladoria Jurídica

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Controladoria Jurídica como posto de comando da operação processual e corrigir a navegação da Central Processual.

**Architecture:** A Controladoria não cria dado novo, exceto protocolos: ela lê `tarefas`, `publicacoes`, `audiencias`, `process_movements`, `andamentos` e `documentos` por um serviço que separa consulta (`fetch*`) de montagem (`build*`), como o painel operacional já faz — a montagem é função pura e é onde ficam os testes. A Central Processual passa a espelhar seu estado na URL e a régua do aplicativo passa a restaurar a rolagem ao voltar.

**Tech Stack:** React 18, TypeScript, Vite, React Router 6, TanStack Query, Tailwind, shadcn/ui, Supabase (Postgres + RLS), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-25-controladoria-juridica-design.md`

## Global Constraints

- Prazo continua sendo `tarefas`; nenhum dado migra para tabela nova.
- Nenhuma decisão de autorização usa `user_metadata`.
- Toda tabela pública nova tem RLS habilitada e `GRANT` explícito.
- Função privilegiada tem `search_path` fixo e execução revogada de `PUBLIC`.
- A visibilidade dos módulos jurídicos é do escritório inteiro. Não
  reintroduzir restrição por registro: a migration
  `20260807210000_processos_tarefas_tenant_rls.sql` a removeu de propósito.
- Contadores usam `select("id", { count: "exact", head: true })`; listas usam
  `limit`/`range` com filtro e ordenação no servidor.
- Arquivos abaixo de 500 linhas. Página é composição; cálculo vai para `src/lib`.
- Comandos: `npm test -- <arquivo>`, `npm run lint`, `npm run build`.
- Commits seguem conventional commits e **não** levam trailer `Co-Authored-By`.
- Textos de interface em português do Brasil.

## Fases

**Fase A (Tarefas 1–3)** conserta a Central Processual e é publicável sozinha.
**Fase B (Tarefas 4–12)** entrega a Controladoria. A Tarefa 13 fecha as duas.

---

### Task 1: Restauração de rolagem na régua do aplicativo

**Files:**
- Create: `src/lib/scroll-restoration.ts`
- Create: `src/hooks/useScrollRestoration.ts`
- Modify: `src/components/layout/AppLayout.tsx`
- Test: `src/test/scroll-restoration.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `restoreScrollOffset(offset: number, deps: ScrollRestoreDeps, startedAt?: number): void`, `interface ScrollRestoreDeps`, `useScrollRestoration(): void`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/test/scroll-restoration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { restoreScrollOffset } from "@/lib/scroll-restoration";

function harness(initialHeight: number) {
  const scrolled: number[] = [];
  const pending: Array<() => void> = [];
  let height = initialHeight;
  let clock = 0;
  return {
    scrolled,
    runNext: () => pending.shift()?.(),
    grow: (value: number) => { height = value; },
    advance: (ms: number) => { clock += ms; },
    deps: {
      documentHeight: () => height,
      viewportHeight: () => 600,
      scrollTo: (offset: number) => scrolled.push(offset),
      now: () => clock,
      schedule: (callback: () => void) => { pending.push(callback); },
    },
  };
}

describe("restoreScrollOffset", () => {
  it("restaura de imediato quando a página já tem altura", () => {
    const h = harness(3000);
    restoreScrollOffset(800, h.deps);
    expect(h.scrolled).toEqual([800]);
  });

  it("espera a lista renderizar antes de restaurar", () => {
    const h = harness(0);
    restoreScrollOffset(800, h.deps);
    expect(h.scrolled).toEqual([]);

    h.grow(3000);
    h.runNext();
    expect(h.scrolled).toEqual([800]);
  });

  it("desiste depois de um segundo e vai até onde a página permite", () => {
    const h = harness(900);
    restoreScrollOffset(5000, h.deps);
    expect(h.scrolled).toEqual([]);

    h.advance(1000);
    h.runNext();
    expect(h.scrolled).toEqual([300]);
  });

  it("vai ao topo quando não há posição guardada", () => {
    const h = harness(3000);
    restoreScrollOffset(0, h.deps);
    expect(h.scrolled).toEqual([0]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/test/scroll-restoration.test.ts`
Expected: FAIL com "Failed to resolve import @/lib/scroll-restoration".

- [ ] **Step 3: Implementar o cálculo**

Criar `src/lib/scroll-restoration.ts`:

```ts
/**
 * Restauração de rolagem para conteúdo que chega depois da navegação.
 *
 * No instante em que o usuário volta, a lista ainda não renderizou: a página
 * tem altura zero e rolar não faz nada. Por isso a restauração insiste a cada
 * quadro até a página caber a posição pedida, e desiste com um limite para
 * não perseguir uma altura que nunca vai chegar.
 */

export interface ScrollRestoreDeps {
  documentHeight: () => number;
  viewportHeight: () => number;
  scrollTo: (offset: number) => void;
  now: () => number;
  schedule: (callback: () => void) => void;
}

/** Tempo máximo de insistência. Acima disso a página não vai mais crescer. */
const GIVE_UP_MS = 1000;

export function restoreScrollOffset(
  offset: number,
  deps: ScrollRestoreDeps,
  startedAt: number = deps.now(),
): void {
  if (offset <= 0) {
    deps.scrollTo(0);
    return;
  }

  const attempt = () => {
    const reachable = deps.documentHeight() - deps.viewportHeight();
    if (reachable >= offset) {
      deps.scrollTo(offset);
      return;
    }
    if (deps.now() - startedAt >= GIVE_UP_MS) {
      deps.scrollTo(Math.max(0, reachable));
      return;
    }
    deps.schedule(attempt);
  };

  attempt();
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/test/scroll-restoration.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Ligar o cálculo à navegação**

Criar `src/hooks/useScrollRestoration.ts`:

```ts
import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { restoreScrollOffset } from "@/lib/scroll-restoration";

const PREFIX = "scroll:";

/**
 * Guarda a posição de cada entrada do histórico e a devolve ao voltar.
 *
 * A chave é a `key` que o roteador dá à entrada: ela é a mesma quando o
 * usuário volta, e diferente quando ele avança para uma tela nova.
 */
export function useScrollRestoration(): void {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const storageKey = `${PREFIX}${location.key}`;

    if (navigationType === "POP") {
      const saved = Number.parseInt(
        window.sessionStorage.getItem(storageKey) ?? "0",
        10,
      );
      restoreScrollOffset(Number.isFinite(saved) ? saved : 0, {
        documentHeight: () => document.documentElement.scrollHeight,
        viewportHeight: () => window.innerHeight,
        scrollTo: (offset) => window.scrollTo(0, offset),
        now: () => performance.now(),
        schedule: (callback) => window.requestAnimationFrame(callback),
      });
    } else {
      window.scrollTo(0, 0);
    }

    return () => {
      // A saída é o único momento em que a posição ainda é a do usuário.
      window.sessionStorage.setItem(storageKey, String(window.scrollY));
    };
  }, [location.key, navigationType]);
}
```

- [ ] **Step 6: Chamar o hook na régua**

Em `src/components/layout/AppLayout.tsx`, importar e chamar dentro de
`AppLayout`, logo após `const [sidebarOpen, setSidebarOpen] = useState(false);`:

```tsx
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
```

```tsx
  useScrollRestoration();
```

O hook precisa vir **antes** do `if (isInsideAppLayout) return <>{children}</>;`
já existente — hook depois de retorno condicional quebra a ordem de hooks do
React e o ESLint acusa.

- [ ] **Step 7: Conferir que a régua não regrediu**

Run: `npm test -- src/test/AppLayout.test.tsx src/test/AppHeader.test.tsx src/test/scroll-restoration.test.ts`
Expected: PASS. Se `AppLayout.test.tsx` reclamar de `window.scrollTo` não
implementado no jsdom, adicionar no próprio arquivo de teste, antes do
`describe`: `window.scrollTo = vi.fn();`

- [ ] **Step 8: Commit**

```bash
git add src/lib/scroll-restoration.ts src/hooks/useScrollRestoration.ts src/components/layout/AppLayout.tsx src/test/scroll-restoration.test.ts src/test/AppLayout.test.tsx
git commit -m "feat: restaurar a rolagem ao voltar para uma lista"
```

---

### Task 2: Estado da Central Processual na URL

**Files:**
- Create: `src/lib/process-workspace.ts`
- Modify: `src/pages/Processos.tsx`
- Test: `src/test/process-workspace.test.ts`

**Interfaces:**
- Consumes: `IntelligenceFilters`, `EMPTY_INTELLIGENCE_FILTERS` de `@/lib/process-intelligence-workspace`.
- Produces: `type ProcessTab = "central" | "pipeline" | "lista"`, `type ProcessSituation = "ativos" | "arquivados" | "todos"`, `interface ProcessRouteState { tab; situation; limit; filters }`, `parseProcessRoute(params: URLSearchParams): ProcessRouteState`, `processRouteParams(state: ProcessRouteState): URLSearchParams`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/test/process-workspace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseProcessRoute, processRouteParams } from "@/lib/process-workspace";

describe("estado da Central Processual na URL", () => {
  it("usa os padrões quando a URL está vazia", () => {
    expect(parseProcessRoute(new URLSearchParams())).toEqual({
      tab: "central",
      situation: "ativos",
      limit: 40,
      filters: {
        search: "",
        phase: "all",
        waitingOn: "all",
        risk: "all",
        area: "all",
        stalledOnly: false,
      },
    });
  });

  it("preserva o atalho ?focus= que já existia", () => {
    expect(parseProcessRoute(new URLSearchParams("focus=stalled")).filters.stalledOnly).toBe(true);
    expect(parseProcessRoute(new URLSearchParams("focus=office")).filters.waitingOn).toBe("escritorio");
    expect(parseProcessRoute(new URLSearchParams("focus=critical")).filters.risk).toBe("critico");
  });

  it("volta ao padrão diante de valor inválido", () => {
    const state = parseProcessRoute(new URLSearchParams("tab=inventada&situacao=xis&limit=-3"));
    expect(state.tab).toBe("central");
    expect(state.situation).toBe("ativos");
    expect(state.limit).toBe(40);
  });

  it("faz a volta completa entre estado e URL", () => {
    const state = {
      tab: "lista" as const,
      situation: "arquivados" as const,
      limit: 80,
      filters: {
        search: "  Silva  ",
        phase: "recursal" as const,
        waitingOn: "escritorio" as const,
        risk: "critico" as const,
        area: "Trabalhista",
        stalledOnly: true,
      },
    };

    const restored = parseProcessRoute(processRouteParams(state));

    expect(restored).toEqual({ ...state, filters: { ...state.filters, search: "Silva" } });
  });

  it("omite da URL tudo que está no padrão", () => {
    const params = processRouteParams(parseProcessRoute(new URLSearchParams()));
    expect(params.toString()).toBe("");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/test/process-workspace.test.ts`
Expected: FAIL com "Failed to resolve import @/lib/process-workspace".

- [ ] **Step 3: Implementar a leitura e a escrita**

Criar `src/lib/process-workspace.ts`:

```ts
/**
 * Estado da Central Processual espelhado na URL.
 *
 * Sem isso o estado vive em `useState` e morre quando o componente desmonta:
 * voltar da ficha de um processo devolve a tela em branco. Na URL, voltar
 * devolve a busca, os filtros, a aba e a quantidade já carregada.
 */

import {
  EMPTY_INTELLIGENCE_FILTERS,
  type IntelligenceFilters,
} from "@/lib/process-intelligence-workspace";
import type {
  IntelligenceRisk,
  ProcessPhase,
  WaitingOn,
} from "@/types/process-intelligence";

export type ProcessTab = "central" | "pipeline" | "lista";
export type ProcessSituation = "ativos" | "arquivados" | "todos";

export interface ProcessRouteState {
  tab: ProcessTab;
  situation: ProcessSituation;
  limit: number;
  filters: IntelligenceFilters;
}

const TABS = new Set<ProcessTab>(["central", "pipeline", "lista"]);
const SITUATIONS = new Set<ProcessSituation>(["ativos", "arquivados", "todos"]);
const PHASES = new Set<ProcessPhase>([
  "conhecimento",
  "recursal",
  "cumprimento_execucao",
  "suspenso_sobrestado",
  "arquivado_encerrado",
  "nao_identificada",
]);
const WAITING = new Set<WaitingOn>([
  "escritorio",
  "parte_contraria",
  "judiciario",
  "terceiro",
  "indefinido",
]);
const RISKS = new Set<IntelligenceRisk>(["critico", "alto", "atencao", "normal"]);

/** Página carrega de quarenta em quarenta para a Central seguir rápida. */
export const PROCESS_PAGE_SIZE = 40;

/** Atalhos vindos de outras telas continuam valendo como estado inicial. */
function focusFilters(focus: string | null): Partial<IntelligenceFilters> {
  if (focus === "stalled") return { stalledOnly: true };
  if (focus === "office") return { waitingOn: "escritorio" };
  if (focus === "critical") return { risk: "critico" };
  return {};
}

export function parseProcessRoute(params: URLSearchParams): ProcessRouteState {
  const tab = params.get("tab") as ProcessTab | null;
  const situation = params.get("situacao") as ProcessSituation | null;
  const phase = params.get("fase") as ProcessPhase | null;
  const waitingOn = params.get("aguardando") as WaitingOn | null;
  const risk = params.get("risco") as IntelligenceRisk | null;
  const limit = Number.parseInt(params.get("limit") ?? "", 10);

  return {
    tab: tab && TABS.has(tab) ? tab : "central",
    situation: situation && SITUATIONS.has(situation) ? situation : "ativos",
    limit: Number.isFinite(limit) && limit > 0 ? limit : PROCESS_PAGE_SIZE,
    filters: {
      ...EMPTY_INTELLIGENCE_FILTERS,
      search: params.get("q")?.trim() ?? "",
      phase: phase && PHASES.has(phase) ? phase : "all",
      waitingOn: waitingOn && WAITING.has(waitingOn) ? waitingOn : "all",
      risk: risk && RISKS.has(risk) ? risk : "all",
      area: params.get("area") ?? "all",
      stalledOnly: params.get("parados") === "1",
      ...focusFilters(params.get("focus")),
    },
  };
}

export function processRouteParams(state: ProcessRouteState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab !== "central") params.set("tab", state.tab);
  if (state.situation !== "ativos") params.set("situacao", state.situation);
  if (state.limit !== PROCESS_PAGE_SIZE) params.set("limit", String(state.limit));

  const { filters } = state;
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.phase !== "all") params.set("fase", filters.phase);
  if (filters.waitingOn !== "all") params.set("aguardando", filters.waitingOn);
  if (filters.risk !== "all") params.set("risco", filters.risk);
  if (filters.area !== "all") params.set("area", filters.area);
  if (filters.stalledOnly) params.set("parados", "1");
  return params;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/test/process-workspace.test.ts`
Expected: PASS, 5 testes.

Se `WaitingOn` ou `IntelligenceRisk` tiverem valores diferentes dos listados,
conferir `src/types/process-intelligence.ts` e corrigir os conjuntos — a
verdade é o tipo, não este plano.

- [ ] **Step 5: Ligar a página à URL**

Em `src/pages/Processos.tsx`, trocar o estado local pelo estado da URL:

```tsx
import { parseProcessRoute, processRouteParams, PROCESS_PAGE_SIZE, type ProcessRouteState } from "@/lib/process-workspace";
```

```tsx
  const [searchParams, setSearchParams] = useSearchParams();
  const route = useMemo(() => parseProcessRoute(searchParams), [searchParams]);
  const { filters, tab, limit } = route;

  // `replace` e não `push`: sem isso cada tecla digitada na busca vira uma
  // entrada de histórico e o botão Voltar passa a desfazer letra por letra.
  const updateRoute = useCallback((patch: Partial<ProcessRouteState>) => {
    setSearchParams(processRouteParams({ ...route, ...patch }), { replace: true });
  }, [route, setSearchParams]);

  const setFilters = useCallback((patch: Partial<typeof filters>) => {
    updateRoute({ filters: { ...filters, ...patch }, limit: PROCESS_PAGE_SIZE });
  }, [filters, updateRoute]);
```

Substituir os usos antigos:
- `setFilters(current => ({ ...current, search: event.target.value }))` vira `setFilters({ search: event.target.value })`;
- o mesmo para `phase`, `waitingOn`, `risk`, `area` e `stalledOnly`;
- `setFilters(EMPTY_INTELLIGENCE_FILTERS)` vira `updateRoute({ filters: EMPTY_INTELLIGENCE_FILTERS, limit: PROCESS_PAGE_SIZE })`;
- `setDisplayLimit(limit => limit + 40)` vira `updateRoute({ limit: limit + PROCESS_PAGE_SIZE })`;
- `<Tabs defaultValue="central">` vira `<Tabs value={tab} onValueChange={value => updateRoute({ tab: value as ProcessTab })}>`;
- `visibleItems` passa a usar `filtered.slice(0, limit)`.

Remover `displayLimit`, seu `useState` e o `useEffect` que o reiniciava: quem
reinicia a paginação agora é `setFilters`.

- [ ] **Step 6: Verificar a Central inteira**

Run: `npm test -- src/test/process-workspace.test.ts src/test/process-intelligence-workspace.test.ts`
Expected: PASS.

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/process-workspace.ts src/pages/Processos.tsx src/test/process-workspace.test.ts
git commit -m "feat: preservar filtros e aba da Central Processual na URL"
```

---

### Task 3: Separar processos arquivados dos ativos

**Files:**
- Modify: `src/lib/process-intelligence-workspace.ts`
- Modify: `src/pages/Processos.tsx`
- Test: `src/test/process-intelligence-workspace.test.ts`

**Interfaces:**
- Consumes: `ProcessSituation` da Task 2.
- Produces: `isArchivedProcess(status: string | null): boolean`, `applySituation(items: ProcessIntelligenceItem[], situation: ProcessSituation): ProcessIntelligenceItem[]`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/test/process-intelligence-workspace.test.ts`:

```ts
import { applySituation, isArchivedProcess, intelligenceMetrics } from "@/lib/process-intelligence-workspace";
import type { ProcessIntelligenceItem } from "@/types/process-intelligence";

function item(id: string, status: string | null, stalled: boolean): ProcessIntelligenceItem {
  return {
    id,
    number: `000000${id}-00.2026.8.04.0001`,
    clientName: null,
    clientDocument: null,
    area: null,
    status,
    court: null,
    courtUnit: null,
    lawyer: null,
    updatedAt: "2026-08-01T12:00:00Z",
    intelligence: stalled
      ? ({ isStalled: true, phase: "conhecimento", waitingOn: "escritorio", risk: "normal" } as ProcessIntelligenceItem["intelligence"])
      : null,
  };
}

describe("situação do processo", () => {
  it("reconhece arquivado e encerrado, ignorando caixa e espaços", () => {
    expect(isArchivedProcess("Arquivado")).toBe(true);
    expect(isArchivedProcess(" arquivado ")).toBe(true);
    expect(isArchivedProcess("Encerrado")).toBe(true);
    expect(isArchivedProcess("Em andamento")).toBe(false);
    expect(isArchivedProcess(null)).toBe(false);
  });

  it("mostra só os ativos por padrão", () => {
    const items = [item("1", "Em andamento", false), item("2", "Arquivado", false)];
    expect(applySituation(items, "ativos").map(i => i.id)).toEqual(["1"]);
    expect(applySituation(items, "arquivados").map(i => i.id)).toEqual(["2"]);
    expect(applySituation(items, "todos").map(i => i.id)).toEqual(["1", "2"]);
  });

  it("não conta arquivado como parado", () => {
    const items = applySituation(
      [item("1", "Em andamento", true), item("2", "Arquivado", true)],
      "ativos",
    );
    expect(intelligenceMetrics(items)).toMatchObject({ total: 1, stalled: 1 });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/test/process-intelligence-workspace.test.ts`
Expected: FAIL com "applySituation is not a function".

- [ ] **Step 3: Implementar**

Acrescentar a `src/lib/process-intelligence-workspace.ts`:

```ts
import type { ProcessSituation } from "@/lib/process-workspace";

/**
 * Situação cadastrada, não a fase inferida das movimentações: tirar um
 * processo da mesa por leitura automática esconderia trabalho real.
 */
const ARCHIVED = new Set(["arquivado", "encerrado"]);

export function isArchivedProcess(status: string | null): boolean {
  return ARCHIVED.has((status ?? "").trim().toLocaleLowerCase("pt-BR"));
}

export function applySituation(
  items: ProcessIntelligenceItem[],
  situation: ProcessSituation,
): ProcessIntelligenceItem[] {
  if (situation === "todos") return items;
  const wantArchived = situation === "arquivados";
  return items.filter(item => isArchivedProcess(item.status) === wantArchived);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/test/process-intelligence-workspace.test.ts`
Expected: PASS.

- [ ] **Step 5: Aplicar na página**

Em `src/pages/Processos.tsx`, aplicar a situação **antes** dos filtros e das
métricas, para que os arquivados não entrem em nenhum número:

```tsx
  const inSituation = useMemo(
    () => applySituation(intelligence.items, route.situation),
    [intelligence.items, route.situation],
  );
  const filtered = useMemo(
    () => filterProcessIntelligence(inSituation, effectiveFilters),
    [effectiveFilters, inSituation],
  );
  const metrics = useMemo(() => intelligenceMetrics(inSituation), [inSituation]);
  const areas = useMemo(
    () => [...new Set(inSituation.map(item => item.area).filter(Boolean) as string[])].sort(),
    [inSituation],
  );
```

Acrescentar o seletor na barra de filtros, ao lado do seletor de área:

```tsx
<Select value={route.situation} onValueChange={value => updateRoute({ situation: value as ProcessSituation, limit: PROCESS_PAGE_SIZE })}>
  <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="ativos">Ativos e em andamento</SelectItem>
    <SelectItem value="arquivados">Arquivados</SelectItem>
    <SelectItem value="todos">Todos</SelectItem>
  </SelectContent>
</Select>
```

O contador de resultados passa a comparar com o universo da situação:
`{filtered.length} de {inSituation.length} processos`.

- [ ] **Step 6: Verificar**

Run: `npm test -- src/test/process-intelligence-workspace.test.ts src/test/process-workspace.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 7: Commit**

```bash
git add src/lib/process-intelligence-workspace.ts src/pages/Processos.tsx src/test/process-intelligence-workspace.test.ts
git commit -m "feat: separar processos arquivados dos ativos na Central"
```

---

### Task 4: Domínio de protocolos no banco

**Files:**
- Create: migration via `npx supabase migration new controladoria_protocolos`
- Create: `supabase/tests/protocolos.sql`

**Interfaces:**
- Produces: tabela `public.protocolos`; colunas `tarefas.tipo`, `documentos.protocolo_id`, `publicacoes.ciencia_em`, `publicacoes.ciencia_por`; função `public.register_protocol(...)` retornando `public.protocolos`.

- [ ] **Step 1: Criar o arquivo de migration**

Run: `npx supabase migration new controladoria_protocolos`
Expected: cria `supabase/migrations/<timestamp>_controladoria_protocolos.sql`.
Não inventar o timestamp: usar o que a CLI gerar.

- [ ] **Step 2: Escrever a migration**

```sql
-- Controladoria Jurídica: protocolo como registro próprio, marcador de prazo
-- e ciência da intimação.
--
-- Nada migra: prazo continua sendo `tarefas`, distinguido por `tipo`.

begin;

-- ---------------------------------------------------------------------------
-- 1. Protocolos
-- ---------------------------------------------------------------------------

create table public.protocolos (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  processo_id uuid references public.processos(id) on delete set null,
  numero_processo text,
  tipo text not null check (tipo in (
    'peticao', 'contestacao', 'recurso', 'apelacao',
    'embargos', 'manifestacao', 'cumprimento', 'outro'
  )),
  descricao text,
  protocolado_em timestamptz not null default now(),
  protocolo_numero text,
  responsavel_id uuid references auth.users(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  observacoes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um protocolo sem processo identificado não serve para controle nenhum.
  constraint protocolos_processo_identificado check (
    processo_id is not null or numero_processo is not null
  )
);

create index protocolos_tenant_data_idx
  on public.protocolos (tenant_id, protocolado_em desc);

create index protocolos_processo_idx
  on public.protocolos (tenant_id, processo_id);

create index protocolos_tarefa_idx
  on public.protocolos (tarefa_id)
  where tarefa_id is not null;

drop trigger if exists protocolos_touch_updated_at on public.protocolos;
create trigger protocolos_touch_updated_at
  before update on public.protocolos
  for each row execute function public.touch_updated_at();

-- A visibilidade é a mesma das tabelas irmãs do módulo jurídico. Restrição
-- por registro foi removida do módulo de propósito em
-- 20260807210000_processos_tarefas_tenant_rls.sql; divergir aqui criaria a
-- única tabela invisível para quem foi convidado ontem.
alter table public.protocolos enable row level security;

create policy tenant_read on public.protocolos
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

revoke all on public.protocolos from public, anon;
grant select on public.protocolos to authenticated;
grant all on public.protocolos to service_role;

-- ---------------------------------------------------------------------------
-- 2. Acréscimos às tabelas existentes
-- ---------------------------------------------------------------------------

-- Sem marcador, um prazo é indistinguível de "ligar para o cliente".
alter table public.tarefas
  add column if not exists tipo text not null default 'tarefa';

alter table public.tarefas
  drop constraint if exists tarefas_tipo_check,
  add constraint tarefas_tipo_check check (tipo in ('tarefa', 'prazo'));

create index if not exists tarefas_tenant_tipo_idx
  on public.tarefas (tenant_id, tipo, status, data_limite);

alter table public.documentos
  add column if not exists protocolo_id uuid
    references public.protocolos(id) on delete set null;

create index if not exists documentos_protocolo_idx
  on public.documentos (protocolo_id)
  where protocolo_id is not null;

-- `review_status` é a triagem do sistema; ciência é ato do escritório.
alter table public.publicacoes
  add column if not exists ciencia_em timestamptz,
  add column if not exists ciencia_por uuid references auth.users(id) on delete set null;

create index if not exists publicacoes_sem_ciencia_idx
  on public.publicacoes (tenant_id, data_publicacao desc)
  where ciencia_em is null;

-- ---------------------------------------------------------------------------
-- 3. Registro de protocolo: uma operação, uma transação
-- ---------------------------------------------------------------------------

create or replace function public.register_protocol(
  p_tenant_id uuid,
  p_tipo text,
  p_protocolado_em timestamptz,
  p_processo_id uuid default null,
  p_numero_processo text default null,
  p_protocolo_numero text default null,
  p_descricao text default null,
  p_observacoes text default null,
  p_responsavel_id uuid default null,
  p_tarefa_id uuid default null
)
returns public.protocolos
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  novo public.protocolos;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if not private.has_tenant_permission(p_tenant_id, 'legal', 'create') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_processo_id is not null and not exists (
    select 1 from public.processos
    where id = p_processo_id and tenant_id = p_tenant_id
  ) then
    raise exception 'processo_not_found' using errcode = 'P0002';
  end if;

  if p_tarefa_id is not null and not exists (
    select 1 from public.tarefas
    where id = p_tarefa_id and tenant_id = p_tenant_id
  ) then
    raise exception 'tarefa_not_found' using errcode = 'P0002';
  end if;

  insert into public.protocolos (
    tenant_id, processo_id, numero_processo, tipo, descricao,
    protocolado_em, protocolo_numero, responsavel_id, tarefa_id,
    observacoes, created_by
  ) values (
    p_tenant_id, p_processo_id, p_numero_processo, p_tipo, p_descricao,
    coalesce(p_protocolado_em, now()), p_protocolo_numero,
    p_responsavel_id, p_tarefa_id, p_observacoes, auth.uid()
  )
  returning * into novo;

  -- "Protocolado" não é status: é o prazo concluído com o ato registrado.
  -- As duas escritas vivem na mesma transação de propósito.
  if p_tarefa_id is not null then
    update public.tarefas
      set status = 'concluída'
      where id = p_tarefa_id and tenant_id = p_tenant_id;
  end if;

  return novo;
end;
$$;

revoke all on function public.register_protocol(
  uuid, text, timestamptz, uuid, text, text, text, text, uuid, uuid
) from public, anon;

grant execute on function public.register_protocol(
  uuid, text, timestamptz, uuid, text, text, text, text, uuid, uuid
) to authenticated, service_role;

commit;
```

- [ ] **Step 3: Escrever o teste SQL**

Criar `supabase/tests/protocolos.sql`, no formato dos testes existentes em
`supabase/tests/` (abrir `tenant_access_requests.sql` e seguir a mesma
estrutura de `begin` / asserções / `rollback`). O teste deve cobrir:

1. protocolo criado em um escritório não aparece para membro de outro;
2. membro ativo com leitura no módulo jurídico vê protocolo de outro
   responsável do próprio escritório;
3. quem não é membro ativo não vê nada;
4. `register_protocol` com `p_tarefa_id` conclui a tarefa e cria o protocolo;
5. `register_protocol` com tarefa de outro escritório levanta
   `tarefa_not_found` e **não** deixa protocolo criado;
6. `register_protocol` sem permissão levanta `permission_denied`;
7. tarefa criada sem `tipo` continua com `tipo = 'tarefa'`.

- [ ] **Step 4: Aplicar e testar localmente**

Run: `npx supabase start`
Run: `npx supabase db reset`
Expected: a migration aplica sem erro.

Se o Docker não estiver disponível nesta máquina, parar aqui e registrar no
commit que o teste SQL não foi executado localmente — não seguir para a Task 5
fingindo que passou.

- [ ] **Step 5: Marcar como prazo o que nasce de intimação**

Em `supabase/functions/review-publication-deadline/index.ts`, no `insert` em
`tarefas` (por volta da linha 105), acrescentar três campos ao objeto:

```ts
      tipo: "prazo",
      source_type: "publicacao",
      source_id: publicationId,
```

Sem `tipo: "prazo"` os contadores da Controladoria nascem zerados: todo prazo
gerado a partir de uma intimação continuaria entrando como tarefa comum.
`source_type` e `source_id` dão o caminho direto de volta à intimação, que
hoje só existe passando por `deadline_suggestions`.

- [ ] **Step 6: Atualizar os tipos gerados**

Run: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`
Expected: `protocolos`, `tarefas.tipo`, `documentos.protocolo_id`,
`publicacoes.ciencia_em` e `register_protocol` presentes no arquivo.

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations supabase/tests/protocolos.sql src/integrations/supabase/types.ts supabase/functions/review-publication-deadline/index.ts
git commit -m "feat: criar o dominio de protocolos e o marcador de prazo"
```

---

### Task 5: Cálculo da Controladoria

**Files:**
- Create: `src/types/controladoria.ts`
- Create: `src/lib/controladoria.ts`
- Test: `src/test/controladoria.test.ts`

**Interfaces:**
- Produces: `type ControladoriaUrgency = "vencido" | "hoje" | "amanha" | "proximo" | "sem_prazo"`, `interface ActionItem`, `classifyDeadline(dueDate: string | null, now: Date): { urgency: ControladoriaUrgency; days: number | null; label: string }`, `sortActionItems(items: ActionItem[]): ActionItem[]`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/test/controladoria.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyDeadline, sortActionItems } from "@/lib/controladoria";
import type { ActionItem } from "@/types/controladoria";

const now = new Date(2026, 7, 25, 10, 0, 0);

describe("classifyDeadline", () => {
  it("marca o que já venceu com quantos dias de atraso", () => {
    expect(classifyDeadline("2026-08-23", now)).toEqual({
      urgency: "vencido",
      days: -2,
      label: "venceu há 2 dias",
    });
  });

  it("distingue hoje, amanhã e os próximos", () => {
    expect(classifyDeadline("2026-08-25", now)).toMatchObject({ urgency: "hoje", days: 0, label: "hoje" });
    expect(classifyDeadline("2026-08-26", now)).toMatchObject({ urgency: "amanha", days: 1, label: "amanhã" });
    expect(classifyDeadline("2026-08-29", now)).toMatchObject({ urgency: "proximo", days: 4, label: "faltam 4 dias" });
  });

  it("usa singular quando falta ou passou um dia só", () => {
    expect(classifyDeadline("2026-08-24", now).label).toBe("venceu há 1 dia");
  });

  it("ignora a hora: o dia é o que conta para prazo", () => {
    expect(classifyDeadline("2026-08-25T23:30:00", now).urgency).toBe("hoje");
  });

  it("aceita ausência de prazo sem inventar número", () => {
    expect(classifyDeadline(null, now)).toEqual({ urgency: "sem_prazo", days: null, label: "sem prazo" });
  });
});

describe("sortActionItems", () => {
  function action(id: string, dueDate: string | null, kind: ActionItem["kind"] = "prazo"): ActionItem {
    return { id, kind, title: id, dueDate, processNumber: null, clientName: null, assigneeName: null, assigneeId: null, status: null };
  }

  it("põe o vencido antes de hoje, e hoje antes dos próximos", () => {
    const sorted = sortActionItems([
      action("proximo", "2026-08-29"),
      action("vencido", "2026-08-20"),
      action("hoje", "2026-08-25"),
    ]);
    expect(sorted.map(item => item.id)).toEqual(["vencido", "hoje", "proximo"]);
  });

  it("deixa o que não tem prazo por último, sem descartar", () => {
    const sorted = sortActionItems([action("sem", null, "intimacao"), action("hoje", "2026-08-25")]);
    expect(sorted.map(item => item.id)).toEqual(["hoje", "sem"]);
  });
});
```

O teste usa `new Date(2026, 7, 25)` — construtor local, não `Date.parse` de
string ISO com `Z`, que deslocaria o dia conforme o fuso da máquina.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/test/controladoria.test.ts`
Expected: FAIL com "Failed to resolve import @/lib/controladoria".

- [ ] **Step 3: Criar os tipos**

Criar `src/types/controladoria.ts`:

```ts
export type ControladoriaUrgency =
  | "vencido"
  | "hoje"
  | "amanha"
  | "proximo"
  | "sem_prazo";

export type ActionKind = "prazo" | "intimacao";

/** Linha da camada de ação, já normalizada, venha de onde vier. */
export interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;
  dueDate: string | null;
  processNumber: string | null;
  clientName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  status: string | null;
}

export interface ControladoriaCounters {
  overdue: number;
  today: number;
  nextSevenDays: number;
  withoutAcknowledgement: number;
  withoutAssignee: number;
}

export interface UpcomingHearing {
  id: string;
  tipo: string;
  dataHora: string;
  processId: string | null;
  processNumber: string | null;
  clientName: string | null;
  local: string | null;
}

export interface DoneSummary {
  protocols: number;
  completedDeadlines: number;
}

export interface ControladoriaData {
  generatedAt: string;
  counters: ControladoriaCounters;
  action: ActionItem[];
  upcoming: UpcomingHearing[];
  done: DoneSummary;
  warnings: string[];
}
```

- [ ] **Step 4: Implementar o cálculo**

Criar `src/lib/controladoria.ts`:

```ts
/**
 * Cálculo da Controladoria: quanto falta e o que vem antes.
 *
 * A contagem é em dias corridos porque a data já está correta — quem a
 * calculou em dias úteis foi o calendário forense no momento em que o prazo
 * foi confirmado. Aqui só se mede a distância até uma data que já existe.
 */

import type { ActionItem, ControladoriaUrgency } from "@/types/controladoria";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Meia-noite local: prazo é dia, não instante. */
function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function parseLocalDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function pluralDays(amount: number): string {
  return amount === 1 ? "1 dia" : `${amount} dias`;
}

export function classifyDeadline(
  dueDate: string | null,
  now: Date,
): { urgency: ControladoriaUrgency; days: number | null; label: string } {
  if (!dueDate) return { urgency: "sem_prazo", days: null, label: "sem prazo" };

  const days = Math.round(
    (startOfDay(parseLocalDay(dueDate)) - startOfDay(now)) / DAY_MS,
  );

  if (days < 0) {
    return { urgency: "vencido", days, label: `venceu há ${pluralDays(-days)}` };
  }
  if (days === 0) return { urgency: "hoje", days, label: "hoje" };
  if (days === 1) return { urgency: "amanha", days, label: "amanhã" };
  return { urgency: "proximo", days, label: `faltam ${pluralDays(days)}` };
}

/** Sem prazo vai para o fim da fila, mas nunca some da lista. */
const NO_DEADLINE = Number.MAX_SAFE_INTEGER;

export function sortActionItems(items: ActionItem[]): ActionItem[] {
  return [...items].sort((left, right) => {
    const leftDay = left.dueDate ? startOfDay(parseLocalDay(left.dueDate)) : NO_DEADLINE;
    const rightDay = right.dueDate ? startOfDay(parseLocalDay(right.dueDate)) : NO_DEADLINE;
    if (leftDay !== rightDay) return leftDay - rightDay;
    return left.title.localeCompare(right.title, "pt-BR");
  });
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- src/test/controladoria.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 6: Commit**

```bash
git add src/types/controladoria.ts src/lib/controladoria.ts src/test/controladoria.test.ts
git commit -m "feat: calcular urgencia e ordem da Controladoria"
```

---

### Task 6: Serviço de consulta da Controladoria

**Files:**
- Create: `src/services/controladoria.ts`
- Create: `src/hooks/useControladoria.ts`
- Test: `src/test/controladoria-service.test.ts`

**Interfaces:**
- Consumes: `ControladoriaData`, `ActionItem` (Task 5); `sortActionItems` (Task 5).
- Produces: `buildControladoria(source: ControladoriaSource, now: Date): ControladoriaData`, `fetchControladoria(tenantId: string): Promise<ControladoriaData>`, `useControladoria(tenantId: string | null)`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/test/controladoria-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildControladoria } from "@/services/controladoria";

const now = new Date(2026, 7, 25, 10, 0, 0);

function source(overrides: Record<string, unknown> = {}) {
  return {
    overdueCount: 1,
    todayCount: 3,
    nextSevenDaysCount: 8,
    withoutAcknowledgementCount: 5,
    withoutAssigneeCount: 2,
    deadlines: [
      { id: "d1", titulo: "Apelação", data_limite: "2026-08-24", status: "pendente", responsavel_id: "u1", processo_id: "p1" },
      { id: "d2", titulo: "Contestação", data_limite: "2026-08-25", status: "pendente", responsavel_id: null, processo_id: null },
    ],
    publications: [
      { id: "pub1", numero_processo: "0000777-88", cliente_nome: "Cliente", data_publicacao: "2026-08-23", tipo: "intimacao" },
    ],
    hearings: [
      { id: "h1", tipo: "Instrução", data_hora: "2026-08-25T14:30:00Z", processo_id: "p1", processo_numero: "0000555-11", cliente_nome: null, local: "2ª Vara" },
    ],
    protocolCount: 4,
    completedDeadlineCount: 7,
    members: [{ userId: "u1", name: "Dra. Ana" }],
    warnings: [],
    ...overrides,
  };
}

describe("buildControladoria", () => {
  it("repassa os contadores sem recontar", () => {
    expect(buildControladoria(source(), now).counters).toEqual({
      overdue: 1,
      today: 3,
      nextSevenDays: 8,
      withoutAcknowledgement: 5,
      withoutAssignee: 2,
    });
  });

  it("mistura prazos e intimações em uma lista ordenada por urgência", () => {
    const action = buildControladoria(source(), now).action;
    expect(action.map(item => item.id)).toEqual(["pub1", "d1", "d2"]);
    expect(action[0].kind).toBe("intimacao");
  });

  it("mostra o nome do responsável, não o identificador", () => {
    const action = buildControladoria(source(), now).action;
    expect(action.find(item => item.id === "d1")?.assigneeName).toBe("Dra. Ana");
    expect(action.find(item => item.id === "d2")?.assigneeName).toBeNull();
  });

  it("preserva os avisos de bloco que falhou", () => {
    const data = buildControladoria(source({ warnings: ["Movimentações: timeout"] }), now);
    expect(data.warnings).toEqual(["Movimentações: timeout"]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/test/controladoria-service.test.ts`
Expected: FAIL com "Failed to resolve import @/services/controladoria".

- [ ] **Step 3: Implementar o serviço**

Criar `src/services/controladoria.ts` no formato de
`src/services/operational-dashboard.ts`: um `ControladoriaSource` com o
resultado cru das consultas, `buildControladoria` puro e `fetchControladoria`
disparando tudo em paralelo.

A intimação sem ciência entra na lista de ação com `dueDate` igual a
`data_publicacao` — é o que a ordena junto dos prazos; o rótulo dela na tela
dirá "sem ciência", não "faltam N dias".

```ts
const [
  overdueResult,
  todayResult,
  nextSevenDaysResult,
  withoutAcknowledgementResult,
  withoutAssigneeResult,
  deadlinesResult,
  publicationsResult,
  hearingsResult,
  protocolsResult,
  completedResult,
] = await Promise.all([
  supabase.from("tarefas").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
    .not("data_limite", "is", null).lt("data_limite", today),
  supabase.from("tarefas").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
    .eq("data_limite", today),
  supabase.from("tarefas").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
    .gt("data_limite", today).lte("data_limite", inSevenDays),
  supabase.from("publicacoes").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).is("ciencia_em", null)
    .neq("review_status", "dismissed"),
  supabase.from("tarefas").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
    .is("responsavel_id", null),
  supabase.from("tarefas")
    .select("id, titulo, data_limite, status, responsavel_id, processo_id")
    .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
    .not("data_limite", "is", null).lte("data_limite", inSevenDays)
    .order("data_limite").limit(20),
  supabase.from("publicacoes")
    .select("id, numero_processo, cliente_nome, data_publicacao, tipo")
    .eq("tenant_id", tenantId).is("ciencia_em", null)
    .neq("review_status", "dismissed")
    .order("data_publicacao", { ascending: true }).limit(10),
  supabase.from("audiencias")
    .select("id, tipo, data_hora, processo_id, processo_numero, cliente_nome, local")
    .eq("tenant_id", tenantId).gte("data_hora", now.toISOString())
    .lte("data_hora", sevenDaysIso).order("data_hora").limit(5),
  supabase.from("protocolos").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).gte("protocolado_em", periodStartIso),
  supabase.from("tarefas").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("tipo", "prazo").eq("status", "concluída")
    .gte("concluida_em", periodStartIso),
]);
```

Os avisos seguem o mesmo `addWarning(warnings, label, error)` do painel
operacional, com um rótulo por bloco: `Prazos vencidos`, `Prazos de hoje`,
`Próximos prazos`, `Intimações sem ciência`, `Prazos sem responsável`,
`Lista de ação`, `Intimações`, `Audiências`, `Protocolos`, `Prazos
concluídos`.

Os nomes dos responsáveis vêm de `useActiveTeamMembers`, já existente; o
serviço recebe a lista pronta em `ControladoriaSource.members` e não consulta
a equipe por conta própria.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/test/controladoria-service.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Criar o hook**

Criar `src/hooks/useControladoria.ts` espelhando
`src/hooks/useOperationalDashboard.ts`: `useQuery` com
`queryKey: ["controladoria", tenantId]`, `enabled: Boolean(tenantId)` e
`staleTime` igual ao do painel operacional.

- [ ] **Step 6: Commit**

```bash
git add src/services/controladoria.ts src/hooks/useControladoria.ts src/test/controladoria-service.test.ts
git commit -m "feat: consultar os numeros e as listas da Controladoria"
```

---

### Task 7: Página e camada de ação

**Files:**
- Create: `src/pages/Controladoria.tsx`
- Create: `src/components/controladoria/ControladoriaCounters.tsx`
- Create: `src/components/controladoria/ActionList.tsx`
- Create: `src/components/controladoria/UpcomingBlock.tsx`
- Create: `src/components/controladoria/DoneBlock.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`
- Test: `src/test/Controladoria.test.tsx`

**Interfaces:**
- Consumes: `useControladoria` (Task 6), `classifyDeadline` e `ControladoriaData` (Task 5).
- Produces: rota `/controladoria`; componentes com as props declaradas abaixo.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/test/Controladoria.test.tsx` no formato de
`src/test/Index.test.tsx`: `vi.hoisted` para os mocks, `vi.mock` de
`@/hooks/useControladoria`, `@/contexts/TenantContext`, `@/contexts/AuthContext`
e `@/components/layout/AppLayout`, e um objeto `ControladoriaData` fixo.

Casos:

```tsx
it("mostra os cinco contadores com seus números", () => { /* ... */ });
it("lista o que exige ação com quantos dias faltam", () => { /* ... */ });
it("filtra a lista ao clicar em um contador, sem trocar de tela", () => { /* ... */ });
it("mostra os próximos compromissos e o que foi feito no período", () => { /* ... */ });
it("avisa quando um bloco falhou sem apagar os demais", () => { /* ... */ });
it("mostra estado vazio quando não há nada exigindo ação", () => { /* ... */ });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/test/Controladoria.test.tsx`
Expected: FAIL com "Failed to resolve import @/pages/Controladoria".

- [ ] **Step 3: Implementar os componentes**

Assinaturas exatas, para as tarefas seguintes consumirem sem adivinhar:

```tsx
export function ControladoriaCounters({ counters, active, onSelect }: {
  counters: ControladoriaCounters;
  active: keyof ControladoriaCounters | null;
  onSelect: (counter: keyof ControladoriaCounters | null) => void;
}): JSX.Element;

export function ActionList({ items, now, onOpenProcess, children }: {
  items: ActionItem[];
  now: Date;
  onOpenProcess: (processNumber: string | null) => void;
  children?: (item: ActionItem) => React.ReactNode;
}): JSX.Element;

export function UpcomingBlock({ hearings }: { hearings: UpcomingHearing[] }): JSX.Element;

export function DoneBlock({ done, periodDays }: { done: DoneSummary; periodDays: number }): JSX.Element;
```

`ActionList` recebe as ações por `children` para não conhecer serviço nenhum:
quem monta os botões é a página, na Task 9. Até lá, `children` fica ausente e
a lista é só leitura.

- [ ] **Step 4: Implementar os dois filtros de tela**

A página guarda escopo e período na URL, pelo mesmo mecanismo da Task 2:

```tsx
export type ControladoriaScope = "meus" | "escritorio";

// Período em dias dos blocos "feito" e "compromissos". Padrão sete.
const PERIODS = [7, 15, 30] as const;
```

`escopo=meus` filtra a lista de ação por `assigneeId === user.id` **no
cliente**, e o código deve dizer por quê: é conveniência sobre o que a pessoa
já enxerga, não fronteira de segurança — a fronteira está na RLS, que hoje dá
visibilidade de escritório para o módulo jurídico. Nunca apresentar esse
seletor como restrição de acesso na interface.

O período entra em `useControladoria(tenantId, periodDays)` e faz parte da
`queryKey`, senão trocar o período devolve o resultado em cache do período
anterior.

- [ ] **Step 5: Registrar a rota e o menu**

Em `src/App.tsx`, junto das demais rotas protegidas:

```tsx
<Route path="/controladoria" element={<Controladoria />} />
```

Em `src/components/layout/AppSidebar.tsx`, no grupo "Rotina jurídica", antes
de Agenda:

```tsx
{ label: "Controladoria Jurídica", icon: ClipboardCheck, path: "/controladoria" },
```

`ClipboardCheck` vem de `lucide-react` e precisa entrar no import existente.

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm test -- src/test/Controladoria.test.tsx src/test/AppSidebar.test.tsx`
Expected: PASS. `AppSidebar.test.tsx` pode precisar do item novo na lista
esperada — atualizar o teste, não o menu.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Controladoria.tsx src/components/controladoria src/App.tsx src/components/layout/AppSidebar.tsx src/test/Controladoria.test.tsx src/test/AppSidebar.test.tsx
git commit -m "feat: abrir a Controladoria com a camada de acao"
```

---

### Task 8: Abas por domínio

**Files:**
- Create: `src/components/controladoria/tabs/PrazosTab.tsx`
- Create: `src/components/controladoria/tabs/IntimacoesTab.tsx`
- Create: `src/components/controladoria/tabs/AudienciasTab.tsx`
- Create: `src/components/controladoria/tabs/ProtocolosTab.tsx`
- Create: `src/components/controladoria/tabs/MovimentacoesTab.tsx`
- Create: `src/components/controladoria/tabs/DocumentosTab.tsx`
- Create: `src/services/controladoria-tabs.ts`
- Modify: `src/pages/Controladoria.tsx`
- Test: `src/test/controladoria-tabs.test.ts`

**Interfaces:**
- Consumes: `classifyDeadline` (Task 5).
- Produces: `fetchTabPage(tab: ControladoriaTab, params: TabQuery): Promise<TabPage>`, `interface TabQuery { tenantId: string; page: number; pageSize: number; assigneeId: string | null; status: string | null; processId: string | null; from: string | null; to: string | null }`.

- [ ] **Step 1: Escrever o teste da paginação e dos filtros**

Criar `src/test/controladoria-tabs.test.ts` testando a função pura que traduz
`TabQuery` em intervalo (`range`) e em conjunto de filtros — sem tocar em
Supabase. Casos: página 1 vira `range(0, 19)`; página 3 com `pageSize` 20 vira
`range(40, 59)`; `pageSize` fora de `[10, 20, 50]` volta para 20.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/test/controladoria-tabs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar as consultas paginadas e as abas**

Cada aba é um componente de leitura com filtro por responsável, status,
processo e período, recebendo dados por props. Nenhuma aba consulta o banco
por conta própria: quem consulta é `fetchTabPage`.

- [ ] **Step 4: Verificar**

Run: `npm test -- src/test/controladoria-tabs.test.ts src/test/Controladoria.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/controladoria/tabs src/services/controladoria-tabs.ts src/pages/Controladoria.tsx src/test/controladoria-tabs.test.ts
git commit -m "feat: abrir as abas por dominio da Controladoria"
```

---

### Task 9: Ações inline — ciência, prazo, responsável e status

**Files:**
- Create: `src/services/controladoria-actions.ts`
- Modify: `src/pages/Controladoria.tsx`
- Modify: `src/components/controladoria/tabs/IntimacoesTab.tsx`
- Modify: `src/components/controladoria/tabs/PrazosTab.tsx`
- Test: `src/test/controladoria-actions.test.ts`

**Interfaces:**
- Consumes: `EdgeFunctionError`, `readEdgeError` de `@/lib/edge-errors`; `ActivityStatus` de `@/types/activities`.
- Produces: `describePostgrestError(error: { code?: string; message?: string } | null): string`, `acknowledgePublication(tenantId: string, publicationId: string, userId: string): Promise<void>`, `assignDeadline(tenantId: string, taskId: string, assigneeId: string | null): Promise<void>`, `changeDeadlineStatus(tenantId: string, taskId: string, status: ActivityStatus): Promise<void>`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/test/controladoria-actions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describePostgrestError } from "@/services/controladoria-actions";

describe("describePostgrestError", () => {
  it("diz que faltou permissão em vez de falar em erro", () => {
    expect(describePostgrestError({ code: "42501", message: "permission denied for table tarefas" }))
      .toBe("Seu acesso não permite esta ação neste escritório.");
  });

  it("reconhece a linha que não existe mais", () => {
    expect(describePostgrestError({ code: "PGRST116", message: "" }))
      .toBe("Este registro não está mais disponível. Atualize a tela.");
  });

  it("esconde o detalhe interno de uma falha desconhecida", () => {
    const message = describePostgrestError({ code: "XX000", message: "internal: relation pg_toast_4711" });
    expect(message).toContain("Não foi possível concluir");
    expect(message).not.toContain("pg_toast");
  });

  it("trata ausência de erro estruturado", () => {
    expect(describePostgrestError(null)).toContain("Não foi possível concluir");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/test/controladoria-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`acknowledgePublication` faz `update` em `publicacoes` gravando `ciencia_em` e
`ciencia_por`. A geração de prazo **reaproveita** a Edge Function
`review-publication-deadline` que já existe — não duplicar a regra de cálculo.

- [ ] **Step 4: Verificar**

Run: `npm test -- src/test/controladoria-actions.test.ts src/test/Controladoria.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/controladoria-actions.ts src/pages/Controladoria.tsx src/components/controladoria/tabs src/test/controladoria-actions.test.ts
git commit -m "feat: dar ciencia e conduzir prazos pela Controladoria"
```

---

### Task 10: Registro de protocolo com anexos

**Files:**
- Create: `src/components/controladoria/ProtocoloDialog.tsx`
- Modify: `src/services/controladoria-actions.ts`
- Modify: `src/components/controladoria/tabs/ProtocolosTab.tsx`
- Test: `src/test/protocolo-dialog.test.tsx`

**Interfaces:**
- Consumes: `register_protocol` (Task 4).
- Produces: `registerProtocol(input: RegisterProtocolInput): Promise<{ id: string }>`, `interface RegisterProtocolInput { tenantId: string; tipo: ProtocoloTipo; protocoladoEm: string; processoId: string | null; numeroProcesso: string | null; protocoloNumero: string | null; descricao: string | null; observacoes: string | null; responsavelId: string | null; tarefaId: string | null }`.

- [ ] **Step 1: Escrever o teste que falha**

Casos: o diálogo exige tipo e data; exige processo **ou** número do processo;
ao ser aberto a partir de um prazo, já vem com o processo e a tarefa
preenchidos e avisa que concluir o registro conclui o prazo; falha do servidor
mostra a mensagem e **não** fecha o diálogo.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/test/protocolo-dialog.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`registerProtocol` chama `supabase.rpc("register_protocol", { ... })`. Os
anexos são gravados em `documentos` com `protocolo_id`, depois do retorno —
uma falha ao anexar não desfaz o protocolo já registrado; a interface mostra o
estado persistido e permite tentar o anexo de novo.

- [ ] **Step 4: Declarar protocolos na matriz de permissões**

Em `src/lib/permissions.ts`, dentro do grupo já existente que trata de
processos, acrescentar as duas linhas correspondentes à política `legal` que
a tabela usa:

```ts
      {
        module: "legal",
        action: "create",
        label: "Registrar protocolos",
        description: "Lançar peças protocoladas e encerrar o prazo com o ato.",
        base: ["owner", "admin", "lawyer"],
        exception: ["assistant"],
      },
```

Conferir em `private.has_tenant_permission` quais papéis a política realmente
concede antes de preencher `base` e `exception`: a matriz da interface só
orienta o usuário, mas divergir do banco produz botão que promete o que o
servidor recusa. Acrescentar o caso ao `src/test/permissions.test.ts`.

- [ ] **Step 5: Verificar**

Run: `npm test -- src/test/protocolo-dialog.test.tsx src/test/permissions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/controladoria/ProtocoloDialog.tsx src/services/controladoria-actions.ts src/components/controladoria/tabs/ProtocolosTab.tsx src/lib/permissions.ts src/test/protocolo-dialog.test.tsx src/test/permissions.test.ts
git commit -m "feat: registrar protocolo encerrando o prazo"
```

---

### Task 11: Status `em_revisao` nas tarefas

**Files:**
- Modify: `src/types/activities.ts`
- Modify: `src/lib/activity-status.ts`
- Modify: `src/lib/activity-workspace.ts`
- Modify: `src/components/activities/ActivityKanban.tsx`
- Test: `src/test/activity-status.test.ts`

**Interfaces:**
- Produces: `ActivityStatus` passa a incluir `"em_revisao"`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it("aceita revisão como status de atividade", () => {
  expect(isActivityStatus("em_revisao")).toBe(true);
});
```

E um caso garantindo que as métricas não contam revisão como concluída.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/test/activity-status.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Acrescentar `"em_revisao"` ao tipo, ao conjunto de validação, ao rótulo
("Revisão") e à coluna do Kanban, entre "Fazendo" e "Concluídas".

- [ ] **Step 4: Verificar que nada regrediu**

Run: `npm test -- src/test/activity-status.test.ts src/test/activity-workspace.test.ts src/test/Tarefas.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/activities.ts src/lib/activity-status.ts src/lib/activity-workspace.ts src/components/activities/ActivityKanban.tsx src/test/activity-status.test.ts
git commit -m "feat: acrescentar revisao ao fluxo das atividades"
```

---

### Task 12: A home aponta para a Controladoria

**Files:**
- Modify: `src/components/dashboard/AttentionCenter.tsx`
- Modify: `src/pages/Index.tsx`
- Test: `src/test/Index.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
it("leva o centro de atenção para a Controladoria", () => {
  // clicar no item de prazo do Centro de atenção
  expect(navigateMock).toHaveBeenCalledWith("/controladoria?foco=vencidos");
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/test/Index.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Trocar os destinos do Centro de atenção e de "Próximos compromissos" para
`/controladoria`, preservando o foco em parâmetro de busca. A Controladoria lê
`?foco=` e já abre com aquele contador ativo — mesmo mecanismo do `?focus=` da
Central Processual.

- [ ] **Step 4: Verificar**

Run: `npm test -- src/test/Index.test.tsx src/test/Controladoria.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/AttentionCenter.tsx src/pages/Index.tsx src/test/Index.test.tsx
git commit -m "feat: ligar o centro de atencao a Controladoria"
```

---

### Task 13: Verificação completa

- [ ] **Step 1: Suíte inteira**

Run: `npm test`
Expected: todos os arquivos passando.

- [ ] **Step 2: Lint e build**

Run: `npm run lint`
Run: `npm run build`
Expected: sem erros.

- [ ] **Step 3: Testes SQL**

Run: `npx supabase db reset`
Run: os testes de `supabase/tests/protocolos.sql`, pelo mesmo caminho usado
pelos demais arquivos de `supabase/tests/`.

- [ ] **Step 4: Conferir no navegador**

Run: `npm run dev`

Percorrer, nesta ordem:
1. abrir a Controladoria e ler, sem clicar, o vencido, o de hoje, os próximos,
   o sem ciência, o feito na semana e os compromissos;
2. clicar em um contador e ver a lista filtrar sem trocar de tela;
3. dar ciência a uma intimação e gerar o prazo dali mesmo;
4. atribuir responsável a um prazo sem responsável;
5. registrar o protocolo que encerra esse prazo, com comprovante anexado, e
   conferir que o prazo consta concluído;
6. na Central Processual, filtrar, rolar, abrir um processo e voltar —
   confirmando filtros, aba e posição de rolagem;
7. alternar entre Ativos, Arquivados e Todos e conferir que as métricas mudam
   junto;
8. repetir 1 e 6 no celular.

- [ ] **Step 5: Advisors do Supabase**

Rodar os advisors de segurança e desempenho e corrigir o que apontarem sobre
`protocolos` e sobre as colunas novas.

- [ ] **Step 6: Commit final**

```bash
git add -A ':!tmp'
git commit -m "test: fechar a verificacao da Controladoria"
```

## Resultado esperado

O advogado abre a Controladoria e vê, sem clicar, o que venceu, o que vence
hoje, quantos dias faltam, o que entrou sem ciência, o que foi feito e os
próximos compromissos; age dali mesmo; e a Central Processual devolve a tela
exatamente como ele a deixou.
