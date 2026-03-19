import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Processo {
  numero: string;
  cliente_nome?: string;
  area?: string;
  status?: string;
  vara?: string;
  advogado?: string;
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

export const exportProcessosPDF = (processos: Processo[]) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Relatório de Processos", 14, 20);
  doc.setFontSize(9);
  doc.text(`Albertino e Advogados Associados • Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [["Número", "Cliente", "Área", "Status", "Vara", "Advogado"]],
    body: processos.map((p) => [p.numero, p.cliente_nome || "—", p.area, p.status, p.vara || "—", p.advogado || "—"]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`processos-${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportFinanceiroPDF = (registros: FinanceiroRecord[], resumo: { recebido: number; pendente: number; atrasado: number }) => {
  const doc = new jsPDF();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  doc.setFontSize(16);
  doc.text("Relatório Financeiro", 14, 20);
  doc.setFontSize(9);
  doc.text(`Albertino e Advogados Associados • Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 28);

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
  doc.text(`Albertino e Advogados Associados • Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 28);

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
  doc.text(`Albertino e Advogados Associados • ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  doc.setFontSize(11);
  doc.text("Resumo", 14, 40);
  doc.setFontSize(9);
  const receita = data.financeiro.filter(f => f.tipo === "honorario").reduce((s, f) => s + Number(f.valor), 0);
  const despesa = data.financeiro.filter(f => f.tipo !== "honorario").reduce((s, f) => s + Number(f.valor), 0);
  doc.text([
    `Processos: ${data.processos.length}`,
    `Clientes: ${data.clientes.length}`,
    `Documentos: ${data.documentos.length}`,
    `Receita: ${fmt(receita)}  |  Despesa: ${fmt(despesa)}  |  Resultado: ${fmt(receita - despesa)}`,
  ], 14, 48);

  // Processos table
  autoTable(doc, {
    startY: 75,
    head: [["Número", "Cliente", "Área", "Status"]],
    body: data.processos.slice(0, 30).map(p => [p.numero, p.cliente_nome || "—", p.area, p.status]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`relatorio-geral-${new Date().toISOString().slice(0, 10)}.pdf`);
};
