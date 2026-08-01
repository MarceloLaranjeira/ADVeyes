import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

const BUCKET = "marca-escritorio";
const MAX_LOGO_BYTES = 1_500_000;
const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export interface BrandSettings {
  publicName: string | null;
  shortName: string | null;
  logoLightPath: string | null;
  logoDarkPath: string | null;
  iconPath: string | null;
  colorTokens: Record<string, string>;
}

export class BrandSettingsError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

interface BrandSettingsRow {
  public_name: string | null;
  short_name: string | null;
  logo_light_path: string | null;
  logo_dark_path: string | null;
  icon_path: string | null;
  color_tokens: Record<string, string> | null;
}

interface BrandFunctionResponse {
  settings?: BrandSettingsRow | null;
  saved?: boolean;
  upload?: {
    path: string;
    token: string;
    publicUrl: string;
  };
  error?: string;
}

async function invokeBrandSettings(
  body: Record<string, unknown>,
): Promise<BrandFunctionResponse> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("tenant-brand-settings", { body }),
  );
  if (error || !data || typeof data !== "object") {
    throw new BrandSettingsError(
      "operation_failed",
      "Não foi possível acessar a identidade visual.",
    );
  }
  const response = data as BrandFunctionResponse;
  if (response.error) {
    throw new BrandSettingsError(response.error, response.error === "permission_denied"
      ? "Você não tem permissão para alterar a identidade visual."
      : "Não foi possível acessar a identidade visual.");
  }
  return response;
}

export async function loadBrandSettings(
  tenantId: string,
): Promise<BrandSettings> {
  const response = await invokeBrandSettings({ action: "load", tenantId });
  const data = response.settings;

  return {
    publicName: data?.public_name ?? null,
    shortName: data?.short_name ?? null,
    logoLightPath: data?.logo_light_path ?? null,
    logoDarkPath: data?.logo_dark_path ?? null,
    iconPath: data?.icon_path ?? null,
    colorTokens: data?.color_tokens ?? {},
  };
}

export async function uploadBrandLogo(input: {
  tenantId: string;
  file: File;
  variant: "light" | "dark" | "icon";
}): Promise<string> {
  if (!ACCEPTED_TYPES.has(input.file.type)) {
    throw new BrandSettingsError(
      "invalid_type",
      "Use um arquivo PNG, JPG, WEBP ou SVG.",
    );
  }
  if (input.file.size > MAX_LOGO_BYTES) {
    throw new BrandSettingsError(
      "too_large",
      "A imagem precisa ter no máximo 1,5 MB.",
    );
  }

  const extensionByType: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  const extension = extensionByType[input.file.type];
  const response = await invokeBrandSettings({
    action: "create_upload",
    tenantId: input.tenantId,
    variant: input.variant,
    extension,
  });
  if (!response.upload?.path || !response.upload.token || !response.upload.publicUrl) {
    throw new BrandSettingsError(
      "upload_failed",
      "Não foi possível preparar o envio da imagem.",
    );
  }

  const { error } = await withTimeout(
    supabase.storage.from(BUCKET).uploadToSignedUrl(
      response.upload.path,
      response.upload.token,
      input.file,
      {
        cacheControl: "3600",
        contentType: input.file.type,
      },
    ),
    30_000,
  );

  if (error) {
    throw new BrandSettingsError(
      "upload_failed",
      "Não foi possível enviar a imagem. Tente novamente.",
    );
  }

  return response.upload.publicUrl;
}

export async function saveBrandSettings(
  tenantId: string,
  settings: BrandSettings,
): Promise<void> {
  await invokeBrandSettings({ action: "save", tenantId, settings });
}
