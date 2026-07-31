const API_KEY_SCHEME = /^APIKey\s+/i;

export const normalizeDataJudAuthorization = (
  rawValue: string | undefined,
) => {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error("DATAJUD_API_KEY secret not configured");
  }

  const credential = value.replace(API_KEY_SCHEME, "").trim();
  if (!credential) {
    throw new Error("DATAJUD_API_KEY secret is invalid");
  }

  return `APIKey ${credential}`;
};

export const getDataJudAuthorization = () =>
  normalizeDataJudAuthorization(Deno.env.get("DATAJUD_API_KEY"));
