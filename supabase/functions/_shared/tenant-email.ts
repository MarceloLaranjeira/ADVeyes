import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface InvitationEmailInput {
  tenantId: string;
  invitationId: string;
  email: string;
  recipientName?: string | null;
  role: string;
  dataScope: string;
  expiresAt: string;
  acceptUrl: string;
  attemptKey: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  lawyer: "Advogado",
  assistant: "Assistente",
  finance: "Financeiro",
};

const scopeLabels: Record<string, string> = {
  tenant: "Acesso ao escritório",
  team: "Acesso à equipe definida",
  assigned: "Somente itens atribuídos",
};

export async function queueInvitationEmail(
  admin: SupabaseClient,
  input: InvitationEmailInput,
): Promise<boolean> {
  const [{ data: tenant }, { data: brand }] = await Promise.all([
    admin.from("tenants").select("display_name").eq("id", input.tenantId)
      .maybeSingle(),
    admin.from("tenant_brand_settings")
      .select("public_name, email_footer, support_contacts")
      .eq("tenant_id", input.tenantId)
      .maybeSingle(),
  ]);

  const brandName = String(
    brand?.public_name ?? tenant?.display_name ?? "ADVeyes",
  );
  const recipientName = input.recipientName?.trim() || "Olá";
  const role = roleLabels[input.role] ?? input.role;
  const scope = scopeLabels[input.dataScope] ?? input.dataScope;
  const footer = String(
    brand?.email_footer ??
      "Este convite foi enviado pela plataforma ADVeyes.",
  );
  const subject = `Convite para acessar ${brandName}`;
  const messageId = `tenant-invite:${input.invitationId}:${input.attemptKey}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033">
      <h1 style="font-size:24px">${escapeHtml(brandName)}</h1>
      <p>${escapeHtml(recipientName)}, você foi convidado(a) para colaborar.</p>
      <p><strong>Perfil:</strong> ${escapeHtml(role)}<br>
      <strong>Alcance:</strong> ${escapeHtml(scope)}</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(input.acceptUrl)}"
          style="background:#2387e8;color:white;padding:12px 20px;border-radius:6px;text-decoration:none">
          Aceitar convite
        </a>
      </p>
      <p>O link é pessoal, aceita somente <strong>${
    escapeHtml(input.email)
  }</strong>
      e expira em 7 dias.</p>
      <p>Se você não reconhece este convite, ignore esta mensagem.</p>
      <hr style="border:0;border-top:1px solid #e5e7eb">
      <small>${escapeHtml(footer)}</small>
    </div>`;
  const text = [
    `${recipientName}, você foi convidado(a) para acessar ${brandName}.`,
    `Perfil: ${role}. Alcance: ${scope}.`,
    `Aceite em: ${input.acceptUrl}`,
    `O link aceita somente ${input.email} e expira em 7 dias.`,
    "Se você não reconhece este convite, ignore esta mensagem.",
    footer,
  ].join("\n\n");

  const { error } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      run_id: input.invitationId,
      to: input.email,
      from: Deno.env.get("INVITATION_EMAIL_FROM") ??
        "ADVeyes <contato@automatikus.com.br>",
      sender_domain: Deno.env.get("INVITATION_SENDER_DOMAIN") ??
        "automatikus.com.br",
      subject,
      html,
      text,
      purpose: "transactional",
      label: "tenant_invitation",
      idempotency_key: messageId,
      unsubscribe_token: null,
      message_id: messageId,
      queued_at: new Date().toISOString(),
      expires_at: input.expiresAt,
    },
  });

  if (error) {
    console.error("tenant-email: queue failed", error.code);
    return false;
  }

  return true;
}
