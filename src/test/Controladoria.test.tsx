import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ControladoriaData } from "@/types/controladoria";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/hooks/useControladoria", () => ({ useControladoria: queryMock }));
vi.mock("@/hooks/useActiveTeamMembers", () => ({ useActiveTeamMembers: () => ({ data: [] }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { rows: [], page: 1, pageSize: 20, total: 0 }, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/contexts/TenantContext", () => ({ useTenant: () => ({ currentTenant: { tenantId: "tenant-1" } }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import Controladoria from "@/pages/Controladoria";

const data: ControladoriaData = {
  generatedAt: "2026-08-25T14:00:00.000Z",
  counters: { overdue: 1, today: 2, nextSevenDays: 3, withoutAcknowledgement: 4, withoutAssignee: 5 },
  action: [
    { id: "d1", kind: "prazo", title: "Apelação", dueDate: "2026-08-24", processNumber: "0001", clientName: "Cliente A", assigneeId: "u1", assigneeName: "Dra. Ana", status: "pendente" },
    { id: "d2", kind: "prazo", title: "Contestação", dueDate: "2026-08-25", processNumber: null, clientName: null, assigneeId: null, assigneeName: null, status: "pendente" },
    { id: "p1", kind: "intimacao", title: "Intimação", dueDate: "2026-08-23", processNumber: "0002", clientName: null, assigneeId: null, assigneeName: null, status: "sem_ciencia" },
  ],
  upcoming: [{ id: "h1", tipo: "Instrução", dataHora: "2026-08-26T14:00:00Z", processId: "p1", processNumber: "0001", clientName: null, local: "2ª Vara" }],
  done: { protocols: 4, completedDeadlines: 7 },
  warnings: [],
};

describe("Controladoria", () => {
  beforeEach(() => queryMock.mockReturnValue({ data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }));

  it("mostra os cinco contadores com seus números", () => {
    render(<MemoryRouter><Controladoria /></MemoryRouter>);
    [
      ["Vencidos", "1"],
      ["Vencem hoje", "2"],
      ["Próximos 7 dias", "3"],
      ["Sem ciência", "4"],
      ["Sem responsável", "5"],
    ].forEach(([label, value]) => {
      expect(screen.getByRole("button", { name: new RegExp(`${label}.*${value}`, "i") })).toBeInTheDocument();
    });
  });

  it("lista o que exige ação com quantos dias faltam", () => {
    render(<MemoryRouter><Controladoria /></MemoryRouter>);
    expect(screen.getByText("Apelação")).toBeInTheDocument();
    expect(screen.getByText("venceu há 1 dia")).toBeInTheDocument();
  });

  it("filtra a lista ao clicar em um contador, sem trocar de tela", () => {
    render(<MemoryRouter><Controladoria /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /vencidos/i }));
    expect(screen.getByText("Apelação")).toBeInTheDocument();
    expect(screen.queryByText("Contestação")).not.toBeInTheDocument();
  });

  it("mostra os próximos compromissos e o que foi feito no período", () => {
    render(<MemoryRouter><Controladoria /></MemoryRouter>);
    expect(screen.getByText("Instrução")).toBeInTheDocument();
    expect(screen.getAllByText("Protocolos").length).toBeGreaterThan(0);
    expect(screen.getByText("Prazos concluídos")).toBeInTheDocument();
  });

  it("avisa quando um bloco falhou sem apagar os demais", () => {
    queryMock.mockReturnValue({ data: { ...data, warnings: ["Audiências: timeout"] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() });
    render(<MemoryRouter><Controladoria /></MemoryRouter>);
    expect(screen.getByText(/alguns blocos não puderam/i)).toBeInTheDocument();
    expect(screen.getByText("Apelação")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há nada exigindo ação", () => {
    queryMock.mockReturnValue({ data: { ...data, action: [] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() });
    render(<MemoryRouter><Controladoria /></MemoryRouter>);
    expect(screen.getByText("Nada exige ação agora")).toBeInTheDocument();
  });
});
