# Guia de integração — ADVeyes API v1

Base de produção: `https://adveyes.automatikus.com.br/api/v1`

## Autenticação

Crie uma credencial em **Configurações → Integrações & API → API pública v1**.
O token completo aparece uma única vez. Envie-o em todas as chamadas privadas:

```http
Authorization: Bearer adv_live_...
```

O token identifica o escritório; `tenant_id` e `user_id` enviados pelo cliente
são recusados. Conceda apenas os escopos necessários e revogue a credencial
assim que ela deixar de ser usada.

## Primeira requisição

```bash
curl 'https://adveyes.automatikus.com.br/api/v1/processes?limit=50' \
  -H 'Authorization: Bearer adv_live_...'
```

Para criar, alterar ou excluir, envie também uma chave única de idempotência:

```bash
curl -X POST 'https://adveyes.automatikus.com.br/api/v1/contacts' \
  -H 'Authorization: Bearer adv_live_...' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: contato-erp-000001' \
  -d '{"name":"Maria Silva","email":"maria@example.com"}'
```

A mesma chave e o mesmo conteúdo devolvem a resposta original por 24 horas.
Reutilizar a chave com conteúdo diferente devolve `409 idempotency_conflict`.

## Paginação e sincronização incremental

Listagens devolvem `meta.next_cursor`. Passe esse valor sem modificá-lo na
próxima chamada. Para sincronização incremental, combine o cursor com
`updated_after` em ISO 8601. O limite é de 100 registros por página.

## Webhooks

Cadastre uma URL HTTPS e os eventos desejados. O segredo `whsec_...` aparece
uma única vez. O ADVeyes envia:

```http
X-ADVeyes-Event-Id: <uuid>
X-ADVeyes-Timestamp: <unix-seconds>
X-ADVeyes-Signature: v1=<hex-hmac-sha256>
```

A assinatura usa a mensagem `<timestamp>.<corpo-bruto>` e o segredo do
endpoint. Valide antes de converter o JSON, rejeite timestamps com mais de
cinco minutos e deduplique por `X-ADVeyes-Event-Id`.

Exemplo Node.js:

```js
import crypto from "node:crypto";

export function validWebhook(rawBody, headers, secret) {
  const timestamp = headers["x-adveyes-timestamp"];
  const received = headers["x-adveyes-signature"]?.replace(/^v1=/, "");
  if (!timestamp || !received) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
```

O receptor deve responder em até 10 segundos com qualquer status `2xx`.
Falhas transitórias são repetidas em aproximadamente 1 min, 5 min, 30 min,
2 h e 12 h, até seis tentativas totais.

## Erros e limites

Erros usam `application/problem+json` e incluem `code` e `request_id`.
O limite inicial é 120 requisições por minuto por token. Em `429`, respeite o
header `Retry-After`. Informe o `request_id` ao suporte para rastreamento.
