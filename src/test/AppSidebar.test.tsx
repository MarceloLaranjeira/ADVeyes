import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/layout/AppSidebar";

vi.mock("@/hooks/usePlatformAdmin", () => ({
  usePlatformAdmin: () => ({ isPlatformAdmin: false }),
}));

describe("AppSidebar", () => {
  it("destaca a rota ativa sem controlar a rolagem do usuário", () => {
    render(
      <MemoryRouter initialEntries={["/agenda"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation");
    expect(navigation.scrollTop).toBe(0);
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveClass("font-bold");
  });
});
