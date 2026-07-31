import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected">{children}</div>
  ),
}));

vi.mock("@/pages/Index", () => ({
  default: () => <div>Dashboard do escritório</div>,
}));

import HomeEntry from "@/pages/HomeEntry";

describe("HomeEntry", () => {
  it("abre o dashboard do escritório sem desviar administradores", () => {
    render(<HomeEntry />);

    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.getByText("Dashboard do escritório")).toBeInTheDocument();
  });
});
