export interface HearingFactsInput {
  tipo: string;
  vara?: string | null;
  modality?: string | null;
  observacoes?: string | null;
}

export interface HearingFacts {
  /** Etiquetas curtas: tipo da sessão, virtual, ramo do direito e natureza do recurso. */
  badges: string[];
  /** Linhas "Rótulo: valor" gravadas pela importação (classe, matéria, assunto). */
  details: Array<{ label: string; value: string }>;
}

const AREAS: Array<[RegExp, string]> = [
  [/crimin|penal|j[úu]ri|tr[áa]fico|execu[çc][ãa]o penal/i, "Criminal"],
  [/trabalh/i, "Trabalhista"],
  [/previdenci|inss/i, "Previdenciário"],
  [/fam[íi]lia|sucess/i, "Família"],
  [/tribut|fazend/i, "Tributário"],
  [/c[íi]vel|c[ií]vel|consumidor/i, "Cível"],
];

const DETAIL_LABELS = ["Recurso", "Classe", "Matéria", "Assunto"] as const;

function areaOf(...sources: Array<string | null | undefined>): string | null {
  const text = sources.filter(Boolean).join(" ");
  return AREAS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export function hearingFacts(input: HearingFactsInput): HearingFacts {
  const details: HearingFacts["details"] = [];
  for (const line of (input.observacoes ?? "").split("\n")) {
    const match = /^([^:]{2,20}):\s*(.+)$/.exec(line.trim());
    if (match && (DETAIL_LABELS as readonly string[]).includes(match[1])) {
      details.push({ label: match[1], value: match[2].trim() });
    }
  }
  const matter = details.find((item) => item.label === "Matéria")?.value;
  const subject = details.find((item) => item.label === "Assunto")?.value;
  const recourse = details.find((item) => item.label === "Recurso")?.value;

  const badges = [input.tipo];
  if (input.modality === "remote" && !/virtual/i.test(input.tipo)) badges.push("Virtual");
  const area = areaOf(input.vara, matter, subject);
  if (area) badges.push(area);
  if (recourse) badges.push(recourse);
  return { badges: [...new Set(badges.filter(Boolean))], details };
}
