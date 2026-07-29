import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  normalizeEmail,
} from "./tenant-invitations.ts";
import { escapeHtml } from "./tenant-email.ts";

Deno.test("normaliza e-mail", () => {
  assertEquals(normalizeEmail(" Pessoa@Exemplo.COM "), "pessoa@exemplo.com");
});

Deno.test("gera token forte e hash SHA-256", async () => {
  const token = createInvitationToken();
  assert(token.length >= 43);
  assertMatch(token, /^[A-Za-z0-9_-]+$/);
  assertMatch(await hashInvitationToken(token), /^[0-9a-f]{64}$/);
});

Deno.test("expira em sete dias", () => {
  const start = Date.UTC(2026, 6, 29);
  assertEquals(
    invitationExpiresAt(start),
    new Date(start + 7 * 24 * 60 * 60 * 1000).toISOString(),
  );
});

Deno.test("escapa HTML dinâmico", () => {
  assertEquals(
    escapeHtml(`<script>"x" & 'y'</script>`),
    "&lt;script&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/script&gt;",
  );
});
