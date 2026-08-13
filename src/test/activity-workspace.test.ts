import { describe, expect, it } from "vitest";
import { activitiesToCsv, activityRouteParams, filterActivities, paginateActivities, parseActivityRoute, reconcileActivitySelection, sortActivities } from "@/lib/activity-workspace";
import type { ActivityWithUserState } from "@/types/activities";

function activity(overrides: Partial<ActivityWithUserState> = {}): ActivityWithUserState {
  return {
    id: "task-1", tenant_id: "tenant-1", user_id: "creator", titulo: "Protocolar manifestação", descricao: "Prazo processual", prioridade: "alta", status: "pendente", data_limite: "2026-08-14", processo_id: "process-1", responsavel_id: "user-1", concluida_em: null, categoria: "Prazo", pontos: 5, updated_at: "2026-08-13T10:00:00Z", created_at: "2026-08-13T10:00:00Z", google_event_id: null, assignee: null, estimated_hours: null, tags: null, source_id: null, source_type: null, userState: { tenant_id: "tenant-1", tarefa_id: "task-1", user_id: "user-1", favorita: true, lida_em: null, updated_at: "2026-08-13T10:00:00Z" }, process: { id: "process-1", number: "0001", clientId: "client-1", clientName: "Maria" }, ...overrides,
  };
}

describe("activity workspace", () => {
  it("interpreta e serializa rota com padrões seguros", () => {
    const state = parseActivityRoute(new URLSearchParams("view=calendar&scope=mine&status=pendente&priority=alta&page=2&size=10"), "office");
    expect(state).toMatchObject({ view: "calendar", scope: "mine", page: 2, pageSize: 10, filters: { statuses: ["pendente"], priorities: ["alta"] } });
    expect(activityRouteParams(state).get("view")).toBe("calendar");
    expect(parseActivityRoute(new URLSearchParams("view=invalid&page=-3"), "mine")).toMatchObject({ view: "list", scope: "mine", page: 1 });
  });

  it("combina escopo, busca, filtros e prazo", () => {
    const items = [activity(), activity({ id: "task-2", responsavel_id: "user-2", titulo: "Telefonar", prioridade: "baixa", categoria: "Atendimento", data_limite: null, userState: null, process: null })];
    const filters = { search: "maria", statuses: ["pendente" as const], priorities: ["alta" as const], assigneeId: null, processId: "process-1", category: "Prazo", due: "tomorrow" as const, favoritesOnly: true, unreadOnly: true };
    expect(filterActivities(items, filters, "mine", "user-1", new Date(2026, 7, 13))).toEqual([items[0]]);
  });

  it("ordena, pagina e reconcilia seleção", () => {
    const items = [activity(), activity({ id: "task-2", titulo: "Acordo", pontos: 20, data_limite: "2026-08-10" })];
    expect(sortActivities(items, "points")[0].id).toBe("task-2");
    expect(paginateActivities(items, 2, 1)).toMatchObject({ page: 2, totalPages: 2, total: 2, items: [{ id: "task-2" }] });
    expect([...reconcileActivitySelection(new Set(["task-1", "missing"]), items)]).toEqual(["task-1"]);
  });

  it("exporta CSV escapando campos e respeitando relações", () => {
    const csv = activitiesToCsv([activity({ titulo: "Revisar; \"peça\"" })], new Map([["user-1", "Marcelo"]]));
    expect(csv).toContain('"Revisar; ""peça"""');
    expect(csv).toContain('"Marcelo";"0001";"Maria"');
    expect(csv).toContain('"14/08/2026"');
  });
});
