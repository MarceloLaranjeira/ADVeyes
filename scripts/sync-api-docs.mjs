import { copyFile, mkdir } from "node:fs/promises";

await mkdir(new URL("../public/api/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../docs/api/openapi.yaml", import.meta.url),
  new URL("../public/api/openapi.yaml", import.meta.url),
);
await copyFile(
  new URL("../docs/integracoes/whatsapp-meta.openapi.yaml", import.meta.url),
  new URL("../public/api/whatsapp-openapi.yaml", import.meta.url),
);
