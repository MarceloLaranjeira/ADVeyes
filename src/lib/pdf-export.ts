import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Processo {
  numero: string;
  cliente_nome?: string | null;
  area?: string | null;
  class_name?: string | null;
  status?: string | null;
  vara?: string | null;
  adjudicating_body?: string | null;
  tribunal?: string | null;
  advogado?: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
}

interface FinanceiroRecord {
  tipo: string;
  descricao?: string;
  valor: number;
  data_vencimento?: string;
  status?: string;
}

interface Audiencia {
  tipo: string;
  data_hora: string;
  processo_numero?: string;
  cliente_nome?: string;
  vara?: string;
  juiz?: string;
  status?: string;
}

export interface DetailedProcessPDFInput {
  tenantName?: string | null;
  processo: {
    numero: string;
    cliente_nome?: string | null;
    area?: string | null;
    class_name?: string | null;
    status?: string | null;
    vara?: string | null;
    adjudicating_body?: string | null;
    tribunal?: string | null;
    procedural_system?: string | null;
    court_level?: string | null;
    advogado?: string | null;
    data_ajuizamento?: string | null;
    last_legal_sync_at?: string | null;
    legal_data_source?: string | null;
    legal_summary?: string | null;
    polo_ativo?: string | null;
    polo_passivo?: string | null;
    subjects?: Array<{ name?: string }> | null;
    descricao?: string | null;
  };
  parties?: Array<{
    display_name: string;
    side?: string | null;
    procedural_role?: string | null;
    document_masked?: string | null;
  }>;
  movements?: Array<{
    occurred_at?: string | null;
    title?: string | null;
    content?: string | null;
  }>;
  publications?: Array<{
    data_publicacao?: string | null;
    tribunal?: string | null;
    conteudo?: string | null;
    possible_deadline?: string | null;
  }>;
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" } : {}),
  });
}

/**
 * Gera um Dossiê Processual Completo em PDF para um processo específico.
 */
export const exportProcessoDetalhadoPDF = (input: DetailedProcessPDFInput) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const p = input.processo;
  const officeName = input.tenantName || "ADVeyes Gestão Jurídica";
  const generatedAt = new Date().toLocaleString("pt-BR");

  // 1. Cabeçalho Principal (Banner Elegante)
  doc.setFillColor(15, 23, 42); // #0f172a (Navy Dark)
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(officeName.toUpperCase(), 14, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("DOSSIÊ PROCESSUAL COMPLETO", 14, 20);

  doc.setFontSize(8);
  doc.text(`Emissão: ${generatedAt}`, 196, 20, { align: "right" });

  let currentY = 36;

  // 2. Ficha Técnica / Dados Gerais do Processo
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`PROCESSO: ${p.numero}`, 14, currentY);
  currentY += 5;

  const activeParties = p.polo_ativo || (input.parties || [])
    .filter((pt) => pt.side === "ativo")
    .map((pt) => pt.display_name).join(", ") || "Não informado";

  const passiveParties = p.polo_passivo || (input.parties || [])
    .filter((pt) => pt.side === "passivo")
    .map((pt) => pt.display_name).join(", ") || "Não informado";

  const subjectsText = Array.isArray(p.subjects)
    ? p.subjects.map((s) => s.name).filter(Boolean).join(", ")
    : "Não informado";

  autoTable(doc, {
    startY: currentY,
    head: [["CAMPO", "INFORMAÇÃO OFICIAL"]],
    body: [
      ["Número CNJ", p.numero],
      ["Cliente do Escritório", p.cliente_nome || "Não informado"],
      ["Polo Ativo (Autor)", activeParties],
      ["Polo Passivo (Réu)", passiveParties],
      ["Classe / Área", p.class_name || p.area || "Cível"],
      ["Assuntos", subjectsText || "Não informado"],
      ["Vara / Órgão Julgador", p.adjudicating_body || p.vara || "Não informada"],
      ["Tribunal / Sistema", `${p.tribunal || "Não informado"} (${p.procedural_system || "PJe/Projudi"})`],
      ["Grau de Jurisdição", p.court_level || "1º Grau"],
      ["Status do Processo", p.status || "Em andamento"],
      ["Advogado Responsável", p.advogado || "Não informado"],
      ["Data de Ajuizamento", formatDate(p.data_ajuizamento)],
      ["Última Sincronização", `${formatDate(p.last_legal_sync_at, true)} (${p.legal_data_source || "DataJud/CNJ"})`],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", textColor: [71, 85, 105] },
      1: { cellWidth: 134 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 3. Resumo Processual por IA / Leitura da Capa
  if (p.legal_summary) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("RESUMO PROCESSUAL", 14, currentY);
    currentY += 4;

    const summaryLines = doc.splitTextToSize(p.legal_summary, 176);
    const summaryHeight = summaryLines.length * 4 + 6;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, currentY, 182, summaryHeight, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(summaryLines, 17, currentY + 5);

    currentY += summaryHeight + 8;
  }

  // 4. Histórico de Andamentos Judiciais (Movimentações)
  if (input.movements && input.movements.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`ANDAMENTOS PROCESSUAIS DESTAQUE (${input.movements.length})`, 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [["Data", "Título / Categoria", "Conteúdo da Movimentação"]],
      body: input.movements.slice(0, 50).map((m) => [
        formatDate(m.occurred_at),
        m.title || "Andamento Judicial",
        m.content || "Sem descrição detalhada",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 46, fontStyle: "bold" },
        2: { cellWidth: 110 },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // 5. Intimações e Publicações Oficiais (DJEN)
  if (input.publications && input.publications.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`INTIMAÇÕES E PUBLICAÇÕES DO DIÁRIO (${input.publications.length})`, 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [["Data", "Diário / Tribunal", "Teor da Intimação / Publicação"]],
      body: input.publications.slice(0, 30).map((pub) => [
        formatDate(pub.data_publicacao),
        pub.tribunal || "DJEN",
        pub.conteudo || "Publicação registrada no diário",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 35, fontStyle: "bold" },
        2: { cellWidth: 121 },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Rodapé em todas as páginas
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${i} de ${pageCount} · ${officeName} · ADVeyes Gestão Jurídica Inteligente`,
      105,
      290,
      { align: "center" },
    );
  }

  const cleanCnj = p.numero.replace(/\D/g, "");
  doc.save(`dossie-processo-${cleanCnj}.pdf`);
};

export const exportProcessosPDF = (processos: Processo[], tenantName?: string) => {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const officeName = tenantName || "ADVeyes Gestão Jurídica";
  const generatedAt = new Date().toLocaleString("pt-BR");

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(officeName.toUpperCase(), 14, 11);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO GERAL DE PROCESSOS", 14, 18);

  doc.setFontSize(8);
  doc.text(`Emissão: ${generatedAt} · Total: ${processos.length} processos`, 283, 18, { align: "right" });

  autoTable(doc, {
    startY: 30,
    head: [["Número CNJ", "Cliente", "Polo Ativo", "Polo Passivo", "Classe / Área", "Status", "Vara / Órgão Julgador", "Advogado"]],
    body: processos.map((p) => [
      p.numero,
      p.cliente_nome || "—",
      p.polo_ativo || "—",
      p.polo_passivo || "—",
      p.class_name || p.area || "Cível",
      p.status || "Em andamento",
      p.adjudicating_body || p.vara || "—",
      p.advogado || "—",
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${pageCount} · ${officeName} · ADVeyes`, 148, 202, { align: "center" });
  }

  doc.save(`relatorio-processos-${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportFinanceiroPDF = (registros: FinanceiroRecord[], resumo: { recebido: number; pendente: number; atrasado: number }) => {
  const doc = new jsPDF();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  doc.setFontSize(16);
  doc.text("Relatório Financeiro", 14, 20);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  doc.setFontSize(10);
  doc.text(`Recebido: ${fmt(resumo.recebido)}  |  Pendente: ${fmt(resumo.pendente)}  |  Atrasado: ${fmt(resumo.atrasado)}`, 14, 38);

  autoTable(doc, {
    startY: 45,
    head: [["Tipo", "Descrição", "Valor", "Vencimento", "Status"]],
    body: registros.map((r) => [
      r.tipo, r.descricao, fmt(Number(r.valor)), r.data_vencimento || "—", r.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`financeiro-${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportAudienciasPDF = (audiencias: Audiencia[]) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Relatório de Audiências", 14, 20);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [["Tipo", "Data/Hora", "Processo", "Cliente", "Vara", "Magistrado", "Status"]],
    body: audiencias.map((a) => [
      a.tipo,
      new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
      a.processo_numero || "—",
      a.cliente_nome || "—",
      a.vara || "—",
      a.juiz || "—",
      a.status,
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`audiencias-${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportRelatorioGeralPDF = (data: {
  processos: Processo[];
  clientes: Record<string, unknown>[];
  financeiro: FinanceiroRecord[];
  documentos: Record<string, unknown>[];
}) => {
  const doc = new jsPDF();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  doc.setFontSize(18);
  doc.text("Relatório Geral do Escritório", 14, 20);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  doc.setFontSize(11);
  doc.text("Resumo", 14, 40);
  doc.setFontSize(9);
  const receita = data.financeiro.filter((f) => f.tipo === "honorario").reduce((s, f) => s + Number(f.valor), 0);
  const despesa = data.financeiro.filter((f) => f.tipo !== "honorario").reduce((s, f) => s + Number(f.valor), 0);
  doc.text([
    `Processos: ${data.processos.length}`,
    `Clientes: ${data.clientes.length}`,
    `Documentos: ${data.documentos.length}`,
    `Receita: ${fmt(receita)}  |  Despesa: ${fmt(despesa)}  |  Resultado: ${fmt(receita - despesa)}`,
  ], 14, 48);

  autoTable(doc, {
    startY: 75,
    head: [["Número", "Cliente", "Área", "Status"]],
    body: data.processos.slice(0, 30).map((p) => [p.numero, p.cliente_nome || "—", p.area, p.status]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`relatorio-geral-${new Date().toISOString().slice(0, 10)}.pdf`);
};
