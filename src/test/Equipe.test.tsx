import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenantMock, managementMock, toastMock } = vi.hoisted(() => ({
  tenantMock: vi.fn(),
  managementMock: vi.fn(),
  toastMock: vi.fn(),
}));

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

const { readPermissionsMock, updatePermissionsMock } = vi.hoisted(() => ({
  readPermissionsMock: vi.fn(),
  updatePermissionsMock: vi.fn(),
}));

vi.mock("@/hooks/useAccessRequests", () => ({
  useAccessRequests: () => ({
    pending: [],
    decided: [],
    link: { exists: false },
    loading: false,
    mutating: false,
    error: null,
    refresh: vi.fn(),
    decide: vi.fn(),
    generateLink: vi.fn(),
    revokeLink: vi.fn(),
  }),
}));

vi.mock("@/services/team-management", () => ({
  TeamManagementError: class TeamManagementError extends Error {},
  teamManagementService: {
    readPermissions: readPermissionsMock,
    updateMemberPermissions: updatePermissionsMock,
    updateMemberProfile: vi.fn(),
  },
}));

vi.mock("@/contexts/TenantContext", () => ({ useTenant: tenantMock }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: authMock }));
vi.mock("@/hooks/useTeamManagement", () => ({
  useTeamManagement: managementMock,
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Equipe from "@/pages/Equipe";

const baseManagement = {
  members: [],
  invitations: [],
  teams: [],
  loading: false,
  mutating: false,
  error: null,
  refresh: vi.fn(),
  inviteMember: vi.fn(),
  suspendMember: vi.fn(),
  reactivateMember: vi.fn(),
  updateAccess: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
};

describe("Equipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReturnValue({ user: null });
    managementMock.mockReturnValue(baseManagement);
    readPermissionsMock.mockResolvedValue({ permissions: {} });
  });

  it("permite que proprietário abra o convite", () => {
    tenantMock.mockReturnValue({
      currentTenant: {
        tenantId: "00000000-0000-4000-8000-000000000001",
        displayName: "Albertino",
        role: "owner",
      },
    });

    render(<Equipe />);
    fireEvent.click(screen.getByRole("button", { name: /convidar membro/i }));
    expect(screen.getByText("Convidar membro da equipe")).toBeInTheDocument();
    expect(screen.getByText(/expira em 7 dias/i)).toBeInTheDocument();
  });

  it("não mostra ações administrativas para advogado", () => {
    tenantMock.mockReturnValue({
      currentTenant: {
        tenantId: "00000000-0000-4000-8000-000000000001",
        displayName: "Albertino",
        role: "lawyer",
      },
    });

    render(<Equipe />);
    expect(
      screen.queryByRole("button", { name: /convidar membro/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/convites \(0\)/i)).not.toBeInTheDocument();
  });

  it("impede convite para o próprio e-mail", async () => {
    authMock.mockReturnValue({
      user: { email: "marcelolaranjeira33@gmail.com" },
    });
    tenantMock.mockReturnValue({
      currentTenant: {
        tenantId: "00000000-0000-4000-8000-000000000001",
        displayName: "Albertino",
        role: "owner",
      },
    });

    render(<Equipe />);
    fireEvent.click(screen.getByRole("button", { name: /convidar membro/i }));
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Marcelo" },
    });
    fireEvent.change(screen.getByLabelText("E-mail do convite"), {
      target: { value: "marcelolaranjeira33@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "Seu e-mail já possui acesso ao escritório e não precisa de convite.",
        }),
      )
    );
    expect(baseManagement.inviteMember).not.toHaveBeenCalled();
  });

  it("reativa membro suspenso preservado", async () => {
    const reactivateMember = vi.fn().mockResolvedValue({});
    managementMock.mockReturnValue({
      ...baseManagement,
      reactivateMember,
      members: [{
        id: "professional-1",
        membership_id: "membership-1",
        name: "Grazielle",
        email: "grazielle@example.com",
        phone: null,
        job_title: "advogada",
        oab: null,
        hourly_rate: null,
        monthly_hours_target: 160,
        active: false,
        role: "admin",
        data_scope: "tenant",
        status: "suspended",
        team_id: null,
      }],
    });
    tenantMock.mockReturnValue({
      currentTenant: {
        tenantId: "00000000-0000-4000-8000-000000000001",
        displayName: "Albertino",
        role: "owner",
      },
    });

    render(<Equipe />);
    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(reactivateMember).toHaveBeenCalledWith(
      "membership-1",
    ));
  });
  const memberFor = (role: string) => ({
    id: "professional-2",
    membership_id: "membership-2",
    user_id: "user-2",
    name: "Helena",
    email: "helena@example.com",
    phone: null,
    job_title: "advogada",
    oab: null,
    hourly_rate: null,
    monthly_hours_target: 160,
    avatar_url: null,
    active: true,
    role,
    data_scope: "tenant",
    status: "active",
    team_id: null,
  });

  /** Radix ativa a aba no mousedown; fireEvent.click sozinho não troca. */
  const selectTab = (name: RegExp) =>
    fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

  const renderAs = (role: string) => {
    managementMock.mockReturnValue({
      ...baseManagement,
      members: [memberFor("lawyer")],
    });
    tenantMock.mockReturnValue({
      currentTenant: {
        tenantId: "00000000-0000-4000-8000-000000000001",
        displayName: "Albertino",
        role,
      },
    });
    render(<Equipe />);
  };

  it("impede que administrador altere permissões individuais", async () => {
    renderAs("admin");

    selectTab(/permissões/i);

    expect(
      await screen.findByText(/somente o proprietário pode alterar permissões/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Membro")).toBeDisabled();
  });

  it("permite que o proprietário altere permissões individuais", async () => {
    renderAs("owner");

    selectTab(/permissões/i);

    await waitFor(() => expect(screen.getByLabelText("Membro")).not.toBeDisabled());
    expect(
      screen.queryByText(/somente o proprietário pode alterar permissões/i),
    ).not.toBeInTheDocument();
  });

  it("mostra a aba Solicitações somente para o proprietário", () => {
    renderAs("owner");
    expect(screen.getByRole("tab", { name: /solicitações/i })).toBeInTheDocument();
  });

  it("esconde a aba Solicitações do administrador", () => {
    renderAs("admin");
    expect(screen.queryByRole("tab", { name: /solicitações/i })).not.toBeInTheDocument();
  });

  it("oferece o link privado de solicitação apenas ao proprietário", () => {
    renderAs("owner");
    expect(screen.getByRole("button", { name: /link de solicitação/i })).toBeInTheDocument();
  });

  it("não oferece o link privado ao administrador", () => {
    renderAs("admin");
    expect(screen.queryByRole("button", { name: /link de solicitação/i })).not.toBeInTheDocument();
  });

  it("mostra o código de diagnóstico quando a falha é inesperada", async () => {
    const inviteMember = vi.fn().mockRejectedValue(
      Object.assign(new Error("Não foi possível concluir"), {
        code: "operation_failed",
        diagnosticId: "DIAG-4711",
      }),
    );
    authMock.mockReturnValue({ user: { email: "owner@example.com" } });
    managementMock.mockReturnValue({ ...baseManagement, inviteMember });
    tenantMock.mockReturnValue({
      currentTenant: {
        tenantId: "00000000-0000-4000-8000-000000000001",
        displayName: "Albertino",
        role: "owner",
      },
    });

    render(<Equipe />);
    fireEvent.click(screen.getByRole("button", { name: /convidar membro/i }));
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Helena" },
    });
    fireEvent.change(screen.getByLabelText("E-mail do convite"), {
      target: { value: "helena@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("DIAG-4711"),
        }),
      )
    );
  });
});
