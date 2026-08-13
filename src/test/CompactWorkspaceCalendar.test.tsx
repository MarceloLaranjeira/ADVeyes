import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompactWorkspaceCalendar } from "@/components/dashboard/CompactWorkspaceCalendar";

vi.mock("@/hooks/useOperationalCalendar", () => ({
  useOperationalCalendar: () => ({
    items: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("CompactWorkspaceCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 8, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza o mês atual, o resumo do dia e o acesso à Agenda completa", () => {
    render(
      <MemoryRouter>
        <CompactWorkspaceCalendar tenantId="tenant-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Calendário do escritório")).toBeInTheDocument();
    expect(screen.getByText("agosto 2026")).toBeInTheDocument();
    expect(screen.getByText("Nenhum compromisso neste dia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mostrar agenda completa/i })).toBeInTheDocument();
  });
});
