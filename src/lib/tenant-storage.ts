const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return safe.replace(/-+\./g, ".").replace(/^[-.]+|[-.]+$/g, "") || "arquivo";
};

export const buildTenantDocumentPath = ({
  tenantId,
  documentId,
  fileName,
}: {
  tenantId: string;
  documentId: string;
  fileName: string;
}) => {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error("Tenant inválido para armazenamento");
  }

  if (!UUID_PATTERN.test(documentId)) {
    throw new Error("Documento inválido para armazenamento");
  }

  return `${tenantId}/documentos/${documentId}/${sanitizeFileName(fileName)}`;
};
