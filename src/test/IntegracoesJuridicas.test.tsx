import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  disableRegistrationMock,
  discoverMock,
  overviewMock,
  registerMock,
  toastMock,
  updateRegistrationMock,
} = vi.hoisted(() => ({
  disableRegistrationMock: vi.fn(),
  discoverMock: vi.fn(),
  overviewMock: vi.fn(),
  registerMock: vi.fn(),
  toastMock: vi.fn(),
  updateRegistrationMock: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <select value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    currentTenant: {
      tenantId: "tenant-1",
      accessMode: "tenant",
      role: "owner",
    },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/legal-integration", () => ({
  legalIntegrationService: {
    overview: overviewMock,
    register: registerMock,
    updateRegistration: updateRegistrationMock,
    disableRegistration: disableRegistrationMock,
    discover: discoverMock,
    confirmInBatches: vi.fn(),
  },
  PartialConfirmationError: class PartialConfirmationError extends Error {},
}));

vi.mock("@/services/platform-admin", () => ({
  platformAdmin: {
    integrationStatus: vi.fn(),
    setEscavadorToken: vi.fn(),
  },
}));

import IntegracoesJuridicas from "@/pages/IntegracoesJuridicas";

describe("IntegracoesJuridicas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    overviewMock.mockResolvedValue({
      providerConfigured: true,
      access: { role: "owner", canManageAll: true, canMutate: true },
      usage: null,
      professionals: [{
        id: "professional-1",
        nome: "Daniel Ferreira",
        email: "daniel@example.com",
        oab: null,
        cargo: "Advogado",
        ativo: true,
      }],
      registrations: [],
      discoveries: [],
      monitors: [],
      sources: [],
    });
    registerMock.mockResolvedValue({
      registrationId: "registration-1",
      registrationSaved: true,
      discoveryPending: true,
      totalCandidates: 0,
    });
    updateRegistrationMock.mockResolvedValue({ synchronizationScheduled: true });
    disableRegistrationMock.mockResolvedValue({
      disabled: true,
      preservedProcesses: true,
    });
  });

  it("agenda a importação automática sem prender a requisição da tela", async () => {
    render(<IntegracoesJuridicas />);

    await screen.findByText("Daniel Ferreira");
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "professional-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("12345"), {
      target: { value: "5055" },
    });
    fireEvent.click(screen.getByRole("button", {
      name: "Salvar OAB e sincronizar",
    }));

    await waitFor(() => expect(registerMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      professionalId: "professional-1",
      oabNumber: "5055",
      oabState: "AM",
    }));
    expect(discoverMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "OAB salva e sincronização ativada",
    }));
  });

  it("edita uma OAB e agenda a nova referência", async () => {
    overviewMock.mockResolvedValueOnce({
      providerConfigured: true,
      access: { role: "owner", canManageAll: true, canMutate: true },
      usage: null,
      professionals: [{
        id: "professional-1",
        nome: "Daniel Ferreira",
        email: "daniel@example.com",
        oab: "5055/AM",
        cargo: "Advogado",
        ativo: true,
      }],
      registrations: [{
        id: "registration-1",
        professional_id: "professional-1",
        oab_number: "5055",
        oab_state: "AM",
        oab_type: "ADVOGADO",
        status: "verified",
        verified_name: "Daniel Ferreira",
        last_discovery_at: null,
      }],
      discoveries: [],
      monitors: [],
      sources: [],
    });

    render(<IntegracoesJuridicas />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar OAB 5055/AM" }));

    const dialog = screen.getByRole("dialog");
    const inputs = within(dialog).getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "14788" } });
    fireEvent.change(inputs[1], { target: { value: "AM" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(updateRegistrationMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      registrationId: "registration-1",
      professionalId: "professional-1",
      oabNumber: "14788",
      oabState: "AM",
    }));
  });

  it("exclui a OAB sem solicitar exclusão dos processos", async () => {
    overviewMock.mockResolvedValueOnce({
      providerConfigured: true,
      access: { role: "owner", canManageAll: true, canMutate: true },
      usage: null,
      professionals: [{
        id: "professional-1",
        nome: "Daniel Ferreira",
        email: null,
        oab: "5055/AM",
        cargo: "Advogado",
        ativo: true,
      }],
      registrations: [{
        id: "registration-1",
        professional_id: "professional-1",
        oab_number: "5055",
        oab_state: "AM",
        oab_type: "ADVOGADO",
        status: "verified",
        verified_name: null,
        last_discovery_at: null,
      }],
      discoveries: [],
      monitors: [],
      sources: [],
    });

    render(<IntegracoesJuridicas />);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir OAB 5055/AM" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir OAB" }));

    await waitFor(() => expect(disableRegistrationMock).toHaveBeenCalledWith(
      "tenant-1",
      "registration-1",
    ));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining("preservados"),
    }));
  });
});
