import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityWithUserState } from "@/types/activities";

const { createMock, updateMock, removeMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    currentTenant: { tenantId: "tenant-1", role: "owner", displayName: "Escritório" },
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useActiveTeamMembers", () => ({
  useActiveTeamMembers: () => ({
    data: [{ id: "member-1", userId: "user-1", name: "Marcelo Laranjeira", avatarUrl: null, jobTitle: "Advogado" }],
  }),
}));

const task: ActivityWithUserState = {
  id: "task-1",
  tenant_id: "tenant-1",
  user_id: "user-1",
  titulo: "Protocolar manifestação",
  descricao: "Prazo processual",
  prioridade: "alta",
  status: "pendente",
  data_limite: "2026-08-09",
  processo_id: null,
  responsavel_id: "user-1",
  concluida_em: null,
  categoria: "Prazo",
  pontos: 5,
  updated_at: "2026-08-08T12:00:00Z",
  created_at: "2026-08-08T12:00:00Z",
  google_event_id: null,
  assignee: null,
  estimated_hours: null,
  tags: null,
  source_id: null,
  source_type: null,
  userState: null,
};

vi.mock("@/hooks/useActivities", () => ({
  useActivities: () => ({
    activities: [task],
    loading: false,
    error: null,
    create: { mutateAsync: createMock },
    update: { mutateAsync: updateMock },
    remove: { mutateAsync: removeMock },
    setUserState: { mutateAsync: vi.fn() },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  },
}));

import Tarefas from "@/pages/Tarefas";

describe("Tarefas", () => {
  beforeEach(() => {
    sessionStorage.clear();
    createMock.mockReset();
    updateMock.mockReset();
    removeMock.mockReset();
  });

  it("oferece as quatro visões sobre o mesmo núcleo de atividades", () => {
    render(<Tarefas />);

    expect(screen.getByRole("button", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lista" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quadro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desempenho" })).toBeInTheDocument();
    expect(screen.getByText("Protocolar manifestação")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quadro" }));
    expect(screen.getAllByText("A Fazer")).toHaveLength(2);
    expect(screen.getByText("Protocolar manifestação")).toBeInTheDocument();
  });

  it("abre o formulário operacional com responsável, categoria e pontos", () => {
    render(<Tarefas />);
    fireEvent.click(screen.getByRole("button", { name: "Nova Tarefa" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Responsável")).toBeInTheDocument();
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Pontos")).toBeInTheDocument();
    expect(screen.getAllByText("Marcelo Laranjeira").length).toBeGreaterThan(0);
  });
});
