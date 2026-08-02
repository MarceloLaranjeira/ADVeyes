const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  Aacute: "Á",
  aacute: "á",
  Acirc: "Â",
  acirc: "â",
  Agrave: "À",
  agrave: "à",
  Atilde: "Ã",
  atilde: "ã",
  Ccedil: "Ç",
  ccedil: "ç",
  Eacute: "É",
  eacute: "é",
  Ecirc: "Ê",
  ecirc: "ê",
  Iacute: "Í",
  iacute: "í",
  Oacute: "Ó",
  oacute: "ó",
  Ocirc: "Ô",
  ocirc: "ô",
  Otilde: "Õ",
  otilde: "õ",
  Uacute: "Ú",
  uacute: "ú",
  Uuml: "Ü",
  uuml: "ü",
  ordm: "º",
  ordf: "ª",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
};

function decodeOneLayer(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
    (match, entity: string) => {
      if (/^#x/i.test(entity)) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith("#")) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity] ?? match;
    },
  );
}

export function decodeHtmlEntities(value: string): string {
  let decoded = value;

  for (let layer = 0; layer < 4; layer += 1) {
    const next = decodeOneLayer(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}
