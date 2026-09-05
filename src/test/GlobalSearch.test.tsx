import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "@/components/search/GlobalSearch";

const searchGlobal = vi.fn();

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { tenantId: "tenant-1" } }),
}));

vi.mock("@/services/global-search", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/global-search")>();
  return { ...original, searchGlobal: (...args: unknown[]) => searchGlobal(...args) };
});

function Location() {
  return <span data-testid="location">{useLocation().pathname}{useLocation().search}</span>;
}

afterEach(() => {
  vi.useRealTimers();
  searchGlobal.mockReset();
});

describe("GlobalSearch", () => {
  it("só consulta depois de dois caracteres e abre a pesquisa completa com Enter", async () => {
    vi.useFakeTimers();
    searchGlobal.mockResolvedValue({
      failures: [],
      results: [{ id: "1", kind: "process", title: "0001", subtitle: "TJAM", href: "/processos/1" }],
    });
    render(<MemoryRouter><Routes><Route path="*" element={<><GlobalSearch /><Location /></>} /></Routes></MemoryRouter>);

    const input = screen.getByRole("searchbox", { name: "Busca global" });
    fireEvent.change(input, { target: { value: "a" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchGlobal).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "ação" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchGlobal).toHaveBeenCalledWith("tenant-1", "ação", 5);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/pesquisa?q=a%C3%A7%C3%A3o");
  });

  it("abre diretamente uma sugestão clicada", async () => {
    vi.useFakeTimers();
    searchGlobal.mockResolvedValue({
      failures: [],
      results: [{ id: "1", kind: "contact", title: "Maria", subtitle: "Contato", href: "/clientes?focus=1" }],
    });
    render(<MemoryRouter><Routes><Route path="*" element={<><GlobalSearch /><Location /></>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByRole("searchbox", { name: "Busca global" }), { target: { value: "Maria" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    fireEvent.click(screen.getByRole("option", { name: /Maria/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/clientes?focus=1");
  });
});
