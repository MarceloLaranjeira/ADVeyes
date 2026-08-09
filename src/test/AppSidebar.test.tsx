import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { readSidebarScroll } from "@/lib/sidebar-scroll";

vi.mock("@/hooks/usePlatformAdmin", () => ({
  usePlatformAdmin: () => ({ isPlatformAdmin: false }),
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("valida a posição armazenada", () => {
    expect(readSidebarScroll({ getItem: () => "180" })).toBe(180);
    expect(readSidebarScroll({ getItem: () => "-4" })).toBe(0);
    expect(readSidebarScroll({ getItem: () => "inválido" })).toBe(0);
    expect(readSidebarScroll({ getItem: () => { throw new Error("bloqueado"); } })).toBe(0);
  });

  it("restaura a rolagem na montagem e salva somente quando o usuário rola", () => {
    sessionStorage.setItem("adveyes:rolagem-menu", "140");
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation");
    expect(navigation.scrollTop).toBe(140);

    navigation.scrollTop = 220;
    fireEvent.scroll(navigation);
    expect(sessionStorage.getItem("adveyes:rolagem-menu")).toBe("220");

    fireEvent.click(screen.getByRole("link", { name: "Agenda" }));
    expect(sessionStorage.getItem("adveyes:rolagem-menu")).toBe("220");
  });
});
