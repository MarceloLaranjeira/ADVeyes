import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationalDashboardData } from "@/types/operational-dashboard";

const { dashboardMock, refetchMock, tenantMock } = vi.hoisted(() => ({
  dashboardMock: vi.fn(),
  refetchMock: vi.fn(),
  tenantMock: vi.fn(),
}));

vi.mock("@/hooks/useOperationalDashboard", () => ({
  useOperationalDashboard: dashboardMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "marcelo@example.com", user_metadata: { nome: "Marcelo Silva" } } }),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: tenantMock,
}));

vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/onboarding/OnboardingResumeBanner", () => ({ OnboardingResumeBanner: () => null }));
vi.mock("@/components/TrialBanner", () => ({ TrialBanner: () => null }));
vi.mock("@/components/dashboard/CompactWorkspaceCalendar", () => ({ CompactWorkspaceCalendar: () => <div>Calendário integrado</div> }));
vi.mock("@/components/dashboard/ProcessIntelligenceHomeCards", () => ({ ProcessIntelligenceHomeCards: () => <div>Inteligência processual</div> }));

import Index from "@/pages/Index";

const data: OperationalDashboardData = {
  generatedAt: "2026-08-13T12:00:00Z",
  warnings: [],
  metrics: {
    activeProcesses: 10,
    contacts: 20,
    documents: 5,
    newLeads: 2,
    pendingActivities: 4,
    overdueActivities: 1,
    activitiesToday: 1,
    completedThisMonth: 7,
    pointsThisMonth: 30,
    hearingsNext7Days: 0,
    hoursThisMonth: 8,
    unreadNotifications: 0,
    pendingPublications: 0,
  },
  financial: {
    receivedThisMonth: 1000,
    expensesThisMonth: 200,
    netThisMonth: 800,
    pending: 500,
    overdue: 0,
    monthlyGoal: 2000,
    goalProgress: 50,
  },
  monitoring: { monitoredProcesses: 8, activeCourts: 2, lastVerification: "2026-08-13T10:00:00Z" },
  attention: [],
  upcomingHearings: [],
  notifications: [],
  recentProcesses: [],
  processAreas: [],
};

describe("Meu Painel", () => {
  beforeEach(() => {
    refetchMock.mockReset();
    dashboardMock.mockReset();
    tenantMock.mockReset();
    tenantMock.mockReturnValue({
      currentTenant: { tenantId: "tenant-1", displayName: "Escritório Modelo" },
    });
  });

  it("mostra escritório, indicadores e estados vazios úteis", () => {
    dashboardMock.mockReturnValue({ data, isLoading: false, isError: false, isFetching: false, refetch: refetchMock, dataUpdatedAt: 1 });

    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: /marcelo/i })).toBeInTheDocument();
    expect(screen.getByText(/escritório modelo/i)).toBeInTheDocument();
    expect(screen.getByText("Centro de atenção")).toBeInTheDocument();
    expect(screen.getByText("Tudo sob controle")).toBeInTheDocument();
    expect(screen.getByText("Calendário integrado")).toBeInTheDocument();
  });

  it("preserva o painel quando há falha parcial e permite atualizar", () => {
    dashboardMock.mockReturnValue({ data: { ...data, warnings: ["Financeiro: acesso negado"] }, isLoading: false, isError: false, isFetching: false, refetch: refetchMock, dataUpdatedAt: 1 });

    render(<MemoryRouter><Index /></MemoryRouter>);
    expect(screen.getByText(/alguns indicadores não puderam ser atualizados/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("oferece nova tentativa quando o carregamento falha por completo", () => {
    dashboardMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: refetchMock, dataUpdatedAt: 1 });

    render(<MemoryRouter><Index /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /não foi possível carregar o painel/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("mostra estado vazio acionável quando a conta não tem escritório", () => {
    tenantMock.mockReturnValue({ currentTenant: null });
    dashboardMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, isFetching: false, refetch: refetchMock, dataUpdatedAt: 0 });

    render(<MemoryRouter><Index /></MemoryRouter>);

    // O skeleton só pode aparecer enquanto existe escritório e a consulta carrega.
    expect(screen.queryByLabelText("Carregando painel")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /nenhum escritório ativo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /solicitar acesso/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar escritório/i })).toBeInTheDocument();
  });

  it("não tenta consultar o painel sem escritório selecionado", () => {
    tenantMock.mockReturnValue({ currentTenant: null });
    dashboardMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, isFetching: false, refetch: refetchMock, dataUpdatedAt: 0 });

    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(dashboardMock).toHaveBeenCalledWith(null);
    const atualizar = screen.getByRole("button", { name: /atualizar/i });
    expect(atualizar).toBeDisabled();
    fireEvent.click(atualizar);
    expect(refetchMock).not.toHaveBeenCalled();
  });

  it("mantém o skeleton enquanto o escritório existe e a consulta carrega", () => {
    dashboardMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: true, refetch: refetchMock, dataUpdatedAt: 0 });

    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(screen.getByLabelText("Carregando painel")).toBeInTheDocument();
  });
});
