// Entrega de alertas jurídicos.
//
// O destinatário é o profissional dono da OAB que trouxe o processo — não a
// equipe inteira. Autônomo recebe o próprio alerta; escritório entrega a quem
// tem a OAB cadastrada naquele processo.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type NotificationEvent =
  | "publication_new"
  | "movement_new"
  | "deadline_near"
  | "hearing_near";

export interface Recipient {
  userId: string;
  email: string | null;
  source: "oab" | "assigned" | "owner";
}

interface RecipientRow {
  user_id: string;
  email: string | null;
  source: Recipient["source"];
}

export async function resolveRecipients(
  admin: SupabaseClient,
  input: { tenantId: string; processId: string | null },
): Promise<Recipient[]> {
  if (!input.processId) return [];

  const { data, error } = await admin.rpc("notification_recipients_server", {
    p_tenant_id: input.tenantId,
    p_process_id: input.processId,
  });

  if (error) {
    console.error("legal-notifications: failed to resolve recipients");
    return [];
  }

  return ((data ?? []) as RecipientRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    source: row.source,
  }));
}

/** Preferências do destinatário; ausência de registro significa ativo. */
async function preferencesFor(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    userIds: string[];
    event: NotificationEvent;
  },
): Promise<Map<string, { email: boolean; inApp: boolean }>> {
  const result = new Map<string, { email: boolean; inApp: boolean }>();
  for (const userId of input.userIds) {
    result.set(userId, { email: true, inApp: true });
  }

  const { data, error } = await admin
    .from("notification_preferences")
    .select("user_id, email_enabled, in_app_enabled")
    .eq("tenant_id", input.tenantId)
    .eq("event_type", input.event)
    .in("user_id", input.userIds);

  if (error) {
    console.error("legal-notifications: failed to read preferences");
    return result;
  }

  for (const row of data ?? []) {
    result.set(row.user_id as string, {
      email: row.email_enabled as boolean,
      inApp: row.in_app_enabled as boolean,
    });
  }
  return result;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface AlertContent {
  event: NotificationEvent;
  title: string;
  summary: string;
  processNumber: string | null;
  detailUrl: string | null;
  /** Chave estável para não enviar o mesmo alerta duas vezes. */
  idempotencyKey: string;
}

/**
 * Entrega o alerta pelos canais habilitados. O e-mail entra na fila
 * transacional já existente; a notificação em tela é gravada direto.
 */
export async function deliverLegalAlert(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    processId: string | null;
    content: AlertContent;
  },
): Promise<{ emails: number; inApp: number }> {
  const recipients = await resolveRecipients(admin, {
    tenantId: input.tenantId,
    processId: input.processId,
  });
  if (!recipients.length) return { emails: 0, inApp: 0 };

  const preferences = await preferencesFor(admin, {
    tenantId: input.tenantId,
    userIds: recipients.map((recipient) => recipient.userId),
    event: input.content.event,
  });

  const inAppRows = recipients
    .filter((recipient) => preferences.get(recipient.userId)?.inApp !== false)
    .map((recipient) => ({
      tenant_id: input.tenantId,
      user_id: recipient.userId,
      titulo: input.content.title,
      mensagem: input.content.summary,
      tipo: input.content.event === "publication_new"
        ? "publicacao"
        : "movimentacao",
      processo_numero: input.content.processNumber,
    }));

  if (inAppRows.length) {
    const { error } = await admin.from("notificacoes").insert(inAppRows);
    if (error) console.error("legal-notifications: in-app insert failed");
  }

  let emails = 0;
  for (const recipient of recipients) {
    const preference = preferences.get(recipient.userId);
    if (preference?.email === false || !recipient.email) continue;

    const link = input.content.detailUrl
      ? `<p><a href="${escapeHtml(input.content.detailUrl)}">Abrir no ADVeyes</a></p>`
      : "";
    const html =
      `<div style="font-family:system-ui,sans-serif;line-height:1.6">
        <h2 style="margin:0 0 12px">${escapeHtml(input.content.title)}</h2>
        ${
        input.content.processNumber
          ? `<p><strong>Processo:</strong> ${
            escapeHtml(input.content.processNumber)
          }</p>`
          : ""
      }
        <p>${escapeHtml(input.content.summary)}</p>
        ${link}
        <hr style="border:0;border-top:1px solid #e5e7eb">
        <small>Você recebe este aviso porque sua OAB está vinculada a este
        processo. Ajuste em Configurações → Notificações.</small>
      </div>`;

    const { error } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: recipient.email,
        from: Deno.env.get("INVITATION_EMAIL_FROM") ??
          "ADVeyes <contato@automatikus.com.br>",
        sender_domain: Deno.env.get("INVITATION_SENDER_DOMAIN") ??
          "automatikus.com.br",
        subject: input.content.title,
        html,
        text: [
          input.content.title,
          input.content.processNumber
            ? `Processo: ${input.content.processNumber}`
            : "",
          input.content.summary,
          input.content.detailUrl ?? "",
        ].filter(Boolean).join("\n\n"),
        purpose: "transactional",
        label: `legal_${input.content.event}`,
        idempotency_key:
          `${input.content.idempotencyKey}:${recipient.userId}`,
        queued_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("legal-notifications: email queue failed");
      continue;
    }
    emails += 1;
  }

  return { emails, inApp: inAppRows.length };
}
