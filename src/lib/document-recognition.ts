import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface DocumentInfo {
  tipo?: string;
  processoNumero?: string;
  clienteNome?: string;
  cpf?: string;
}

const tiposDocKeywords: Record<string, string[]> = {
  Petição: ["petição inicial", "petição", "requer", "excelentíssimo", "distribuição"],
  Contestação: ["contestação", "contesta", "réu", "defesa", "impugna"],
  Recurso: ["recurso", "apelação", "agravo", "recurso especial", "recorre"],
  HC: ["habeas corpus", "hc", "coação ilegal", "liberdade", "writ"],
  Alegações: ["alegações finais", "memoriais", "preliminar"],
  Procuração: ["procuração", "constitui", "bastante procurador", "mandato", "outorga"],
  Contrato: ["contrato", "contratante", "contratado", "cláusula", "partes"],
  Parecer: ["parecer", "opinativo", "conclusão", "consulta"],
  Decisão: ["decisão", "despacho", "sentença", "acórdão", "julgo", "condeno", "absolvo"],
};

// Regex for Brazilian process number (CNJ format)
const processoRegex = /\b(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\b/g;

// Regex for CPF
const cpfRegex = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;

// Patterns for client name extraction
const clientePatterns = [
  /REQUERENTE[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-Za-záéíóúâêîôûãõàçÁÉÍÓÚÂÊÎÔÛÃÕÀÇ\s]+?)(?:\s*,|\s*CPF|\s*\n|\s*RG)/i,
  /AUTOR[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-Za-záéíóúâêîôûãõàçÁÉÍÓÚÂÊÎÔÛÃÕÀÇ\s]+?)(?:\s*,|\s*CPF|\s*\n|\s*RG)/i,
  /PACIENTE[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-Za-záéíóúâêîôûãõàçÁÉÍÓÚÂÊÎÔÛÃÕÀÇ\s]+?)(?:\s*,|\s*CPF|\s*\n|\s*RG)/i,
  /IMPETRANTE[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-Za-záéíóúâêîôûãõàçÁÉÍÓÚÂÊÎÔÛÃÕÀÇ\s]+?)(?:\s*,|\s*CPF|\s*\n|\s*RG)/i,
  /OUTORGANTE[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-Za-záéíóúâêîôûãõàçÁÉÍÓÚÂÊÎÔÛÃÕÀÇ\s]+?)(?:\s*,|\s*CPF|\s*\n|\s*RG)/i,
];

function detectDocumentType(text: string): string | undefined {
  const lower = text.toLowerCase();
  let bestMatch: { tipo: string; score: number } | null = null;

  for (const [tipo, keywords] of Object.entries(tiposDocKeywords)) {
    const score = keywords.reduce((acc, kw) => {
      const count = (lower.match(new RegExp(kw, "gi")) || []).length;
      return acc + count;
    }, 0);
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { tipo, score };
    }
  }

  return bestMatch?.tipo;
}

function extractProcessoNumero(text: string): string | undefined {
  const matches = text.match(processoRegex);
  return matches?.[0];
}

function extractCPF(text: string): string | undefined {
  const matches = text.match(cpfRegex);
  return matches?.[0];
}

function extractClienteNome(text: string): string | undefined {
  for (const pattern of clientePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, " ");
    }
  }
  return undefined;
}

export function analyzeText(text: string): DocumentInfo {
  return {
    tipo: detectDocumentType(text),
    processoNumero: extractProcessoNumero(text),
    clienteNome: extractClienteNome(text),
    cpf: extractCPF(text),
  };
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const texts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    texts.push(pageText);
    // Only analyze first 3 pages for performance
    if (i >= 3) break;
  }

  return texts.join("\n");
}

export async function extractTextFromImage(file: File): Promise<string> {
  const result = await Tesseract.recognize(file, "por", {
    logger: () => {},
  });
  return result.data.text;
}

export async function recognizeDocument(file: File): Promise<DocumentInfo> {
  let text = "";
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    text = await extractTextFromPDF(file);
  } else if (["jpg", "jpeg", "png"].includes(ext || "")) {
    text = await extractTextFromImage(file);
  } else if (["txt", "odt"].includes(ext || "")) {
    text = await file.text();
  }

  if (!text.trim()) return {};
  return analyzeText(text);
}
