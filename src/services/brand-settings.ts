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

export async function loadBrandSettings(
  tenantId: string,
): Promise<BrandSettings> {
  const { data, error } = await withTimeout(
    (supabase as never as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data: BrandSettingsRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    })
      .from("tenant_brand_settings")
      .select(
        "public_name, short_name, logo_light_path, logo_dark_path, icon_path, color_tokens",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  );

  if (error) {
    throw new BrandSettingsError(
      "load_failed",
      "Não foi possível carregar a identidade visual.",
    );
  }

  return {
    publicName: data?.public_name ?? null,
    shortName: data?.short_name ?? null,
    logoLightPath: data?.logo_light_path ?? null,
    logoDarkPath: data?.logo_dark_path ?? null,
    iconPath: data?.icon_path ?? null,
    colorTokens: data?.color_tokens ?? {},
  };
}

/**
 * Envia a logo para a pasta do escritório. O primeiro segmento do caminho é o
 * `tenant_id`, que é o que a política do storage usa para isolar os arquivos.
 */
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

  const extension = input.file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${input.tenantId}/${input.variant}-${Date.now()}.${extension}`;

  const { error } = await withTimeout(
    supabase.storage.from(BUCKET).upload(path, input.file, {
      cacheControl: "3600",
      upsert: true,
      contentType: input.file.type,
    }),
    30_000,
  );

  if (error) {
    throw new BrandSettingsError(
      "upload_failed",
      "Não foi possível enviar a imagem. Confira se você tem permissão de administrador.",
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function saveBrandSettings(
  tenantId: string,
  settings: BrandSettings,
): Promise<void> {
  const { error } = await withTimeout(
    (supabase as never as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("tenant_brand_settings")
      .upsert({
        tenant_id: tenantId,
        public_name: settings.publicName,
        short_name: settings.shortName,
        logo_light_path: settings.logoLightPath,
        logo_dark_path: settings.logoDarkPath,
        icon_path: settings.iconPath,
        color_tokens: settings.colorTokens,
      }, { onConflict: "tenant_id" }),
  );

  if (error) {
    throw new BrandSettingsError(
      "save_failed",
      "Não foi possível salvar. Somente proprietário ou administrador pode alterar a identidade visual.",
    );
  }
}
