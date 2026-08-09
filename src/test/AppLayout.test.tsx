import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/layout/AppLayout";

vi.mock("@/components/layout/AppHeader", () => ({
  AppHeader: () => <header>Cabeçalho</header>,
}));

vi.mock("@/components/layout/PlatformSupportBanner", () => ({
  PlatformSupportBanner: () => null,
}));

vi.mock("@/components/layout/AppSidebar", async () => {
  const { Link } = await import("react-router-dom");
  return {
    AppSidebar: () => (
      <nav data-testid="sidebar">
        <Link to="/pagina-a">Página A</Link>
        <Link to="/pagina-b">Página B</Link>
      </nav>
    ),
  };
});

const Page = ({ name }: { name: string }) => (
  <AppLayout>
    <h1>{name}</h1>
  </AppLayout>
);

describe("AppLayout persistente", () => {
  it("mantém a mesma régua montada ao trocar de página", () => {
    render(
      <MemoryRouter initialEntries={["/pagina-a"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/pagina-a" element={<Page name="Página A" />} />
            <Route path="/pagina-b" element={<Page name="Página B" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const sidebar = screen.getByTestId("sidebar");
    sidebar.scrollTop = 180;

    fireEvent.click(screen.getByRole("link", { name: "Página B" }));

    expect(screen.getByRole("heading", { name: "Página B" })).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBe(sidebar);
    expect(sidebar.scrollTop).toBe(180);
  });
});
