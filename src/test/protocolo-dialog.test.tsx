import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { registerProtocolMock, attachMock } = vi.hoisted(() => ({
  registerProtocolMock: vi.fn(),
  attachMock: vi.fn(),
}));

vi.mock("@/services/controladoria-actions", () => ({
  registerProtocol: registerProtocolMock,
  attachProtocolDocuments: attachMock,
}));

import { ProtocoloDialog } from "@/components/controladoria/ProtocoloDialog";

// Radix Select abre no pointerdown e consulta APIs de ponteiro que o jsdom
// não implementa; sem estes stubs o menu nunca chega a abrir no teste.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const onOpenChange = vi.fn();
const onRegistered = vi.fn();

function open(origin: React.ComponentProps<typeof ProtocoloDialog>["origin"] = null) {
  return render(
    <ProtocoloDialog
      open
      tenantId="11111111-1111-4111-8111-111111111111"
      userId="22222222-2222-4222-8222-222222222222"
      origin={origin}
      onOpenChange={onOpenChange}
      onRegistered={onRegistered}
    />,
  );
}

function chooseTipo(label: string) {
  // Abrir pelo teclado em vez do ponteiro: o jsdom não implementa PointerEvent,
  // e de quebra isto exercita o caminho acessível do campo.
  fireEvent.keyDown(screen.getByRole("combobox", { name: /ato protocolado/i }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: label }));
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: /^registrar protocolo$/i }));

describe("ProtocoloDialog", () => {
  beforeEach(() => {
    registerProtocolMock.mockReset().mockResolvedValue({ id: "proto-1" });
    attachMock.mockReset().mockResolvedValue(undefined);
    onOpenChange.mockReset();
    onRegistered.mockReset();
  });

  it("exige o tipo do ato e a data do protocolo", async () => {
    open();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/ato.*data|data.*ato/i);
    expect(registerProtocolMock).not.toHaveBeenCalled();
  });

  it("exige o processo ou o número do processo", async () => {
    open();
    chooseTipo("Petição");
    fill(/protocolado em/i, "2026-08-25");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/número do processo/i);
    expect(registerProtocolMock).not.toHaveBeenCalled();
  });

  it("abre a partir de um prazo já com o processo e a tarefa, avisando que o prazo será concluído", () => {
    open({
      taskId: "33333333-3333-4333-8333-333333333333",
      taskTitle: "Contestação — prazo",
      processId: "44444444-4444-4444-8444-444444444444",
      processNumber: "0000123-45.2026.8.26.0100",
    });

    expect(screen.getByLabelText(/número do processo/i)).toHaveValue("0000123-45.2026.8.26.0100");
    expect(screen.getByText(/conclui o prazo/i)).toBeInTheDocument();
  });

  it("registra o protocolo do prazo e anexa os comprovantes", async () => {
    open({
      taskId: "33333333-3333-4333-8333-333333333333",
      taskTitle: "Contestação — prazo",
      processId: "44444444-4444-4444-8444-444444444444",
      processNumber: "0000123-45.2026.8.26.0100",
    });
    chooseTipo("Contestação");
    fill(/protocolado em/i, "2026-08-25");
    fill(/número do protocolo/i, "PROTO-9");

    const file = new File(["comprovante"], "recibo.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/comprovantes/i), { target: { files: [file] } });
    submit();

    await waitFor(() => expect(registerProtocolMock).toHaveBeenCalledTimes(1));
    expect(registerProtocolMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "11111111-1111-4111-8111-111111111111",
      tipo: "contestacao",
      processoId: "44444444-4444-4444-8444-444444444444",
      numeroProcesso: "0000123-45.2026.8.26.0100",
      protocoloNumero: "PROTO-9",
      tarefaId: "33333333-3333-4333-8333-333333333333",
    }));
    await waitFor(() => expect(attachMock).toHaveBeenCalledWith(expect.objectContaining({
      protocolId: "proto-1",
      files: [file],
    })));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onRegistered).toHaveBeenCalled();
  });

  it("mostra a falha do servidor e mantém o diálogo aberto", async () => {
    registerProtocolMock.mockRejectedValue(new Error("Seu acesso não permite esta ação neste escritório."));
    open();
    chooseTipo("Petição");
    fill(/protocolado em/i, "2026-08-25");
    fill(/número do processo/i, "0000123-45.2026.8.26.0100");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/não permite esta ação/i);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("mantém o protocolo registrado quando só o anexo falha", async () => {
    attachMock.mockRejectedValue(new Error("Falha ao enviar o comprovante."));
    open();
    chooseTipo("Petição");
    fill(/protocolado em/i, "2026-08-25");
    fill(/número do processo/i, "0000123-45.2026.8.26.0100");
    fireEvent.change(screen.getByLabelText(/comprovantes/i), {
      target: { files: [new File(["x"], "recibo.pdf", { type: "application/pdf" })] },
    });
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/comprovante/i);
    expect(screen.getByText(/protocolo já foi registrado/i)).toBeInTheDocument();
    expect(onRegistered).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
