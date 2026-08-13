import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationalCalendarItem } from "@/types/operational-calendar";

const { calendarMock, refetchMock } = vi.hoisted(() => ({ calendarMock: vi.fn(), refetchMock: vi.fn() }));

vi.mock("@/hooks/useOperationalCalendar", () => ({ useOperationalCalendar: calendarMock }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/contexts/TenantContext", () => ({ useTenant: () => ({ currentTenant: { tenantId: "tenant-1", displayName: "Escritório Modelo", role: "owner", dataScope: "tenant", accessMode: "membership" } }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/google-calendar", () => ({ googleCalendar: { handleOAuthResult: vi.fn(() => null), getStatus: vi.fn(async () => ({ connected: false })), connect: vi.fn(), syncNow: vi.fn(), disconnect: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn(), deleteEvent: vi.fn() } }));

import Agenda from "@/pages/Agenda";

const calendarItem: OperationalCalendarItem = {
  id: "event:event-1", sourceType: "event", sourceId: "event-1", date: "2026-08-13T09:00:00", endDate: "2026-08-13T10:00:00", title: "Reunião estratégica", description: "Preparação do caso", type: "reunião", assigneeId: "user-1", processId: "process-1", processNumber: "0001", clientName: "Maria", status: null, priority: null, location: "Escritório", googleEventId: null,
};

describe("Agenda", () => {
  beforeEach(() => {
    refetchMock.mockReset();
    calendarMock.mockReturnValue({
      items: [calendarItem], events: [{ id: "event-1" }], tasks: [], hearings: [],
      members: [{ id: "member-1", userId: "user-1", name: "Marcelo", avatarUrl: null, role: "Advogado" }],
      failures: [], isLoading: false, isError: false, refetch: refetchMock,
    });
  });

  it("abre proprietários na visão do escritório e oferece quatro visualizações", () => {
    render(<MemoryRouter initialEntries={["/agenda?date=2026-08-13"]}><Agenda /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /escopo da agenda/i })).toHaveTextContent("Escritório");
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lista" })).toBeInTheDocument();
  });

  it("mantém os mesmos itens ao alternar para Lista e abre o contexto", () => {
    render(<MemoryRouter initialEntries={["/agenda?date=2026-08-13"]}><Agenda /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Lista" }));
    const itemButton = screen.getByRole("button", { name: /compromisso: reunião estratégica/i });
    expect(itemButton).toBeInTheDocument();
    fireEvent.click(itemButton);
    expect(screen.getByText("Preparação do caso")).toBeInTheDocument();
    expect(screen.getByText(/processo 0001/i)).toBeInTheDocument();
  });
});

