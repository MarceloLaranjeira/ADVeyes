import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, Search, RefreshCw, Bot, CheckCheck, AlertTriangle,
  Calendar, Scale, ChevronDown, ChevronUp, Sparkles, ListTodo,
  FileText, Clock, Eye, Zap, Filter,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Publicacao = {
  id: string;
  user_id: string;
  tipo: string;
  tribunal: string;
  numero_processo: string | null;
  cliente_nome: string | null;
  data_publicacao: string;
  conteudo: string;
  conteudo_simplificado: string | null;
  status: string;
  prazo_dias: number | null;
  data_prazo: string | null;
  tarefa_gerada: boolean;
  created_at: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const CAPTURAR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capturar-publicacoes`;

const tipoLabels: Record<string, { label: string; color: string }> = {
  intimacao: { label: "Intimação", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  despacho: { label: "Despacho", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  sentenca: { label: "Sentença", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  acordao: { label: "Acórdão", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  edital: { label: "Edital", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
  publicacao: { label: "Publicação", color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
};

const MOCK_DATA = [
  {
    tipo: "intimacao",
    tribunal: "TJAM",
    numero_processo: "0001234-56.2024.8.04.0001",
    cliente_nome: "João Carlos da Silva",
    data_publicacao: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    conteudo: `INTIMAÇÃO — 3ª Vara Cível da Comarca de Manaus. Processo nº 0001234-56.2024.8.04.0001. Intimam-se as partes e seus respectivos patronos de que fica DESIGNADA Audiência de Instrução e Julgamento para o dia 15 de abril de 2025, às 14h00, perante este Juízo. Fica, ainda, intimada a parte autora para que apresente rol de testemunhas no prazo improrrogável de 05 (cinco) dias úteis, sob pena de preclusão. Cumpra-se e intimem-se. Manaus/AM, 18 de março de 2026.`,
    status: "urgente",
    prazo_dias: 5,
    data_prazo: addDays(new Date(), 5).toISOString(),
  },
  {
    tipo: "despacho",
    tribunal: "TJAM",
    numero_processo: "0007891-23.2023.8.04.0002",
    cliente_nome: "Maria Aparecida Santos",
    data_publicacao: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    conteudo: `DESPACHO — 2ª Vara de Família e Sucessões. Processo nº 0007891-23.2023.8.04.0002. Considerando a juntada de documentos às fls. 234/256, intime-se a parte requerida para que, no prazo de 15 (quinze) dias, manifeste-se sobre os documentos juntados pela parte autora, especialmente quanto ao laudo de avaliação do imóvel objeto da partilha. Após, venham conclusos para decisão. Manaus/AM, 18 de março de 2026.`,
    status: "nova",
    prazo_dias: 15,
    data_prazo: addDays(new Date(), 15).toISOString(),
  },
  {
    tipo: "sentenca",
    tribunal: "TJAM",
    numero_processo: "0003456-78.2022.8.04.0001",
    cliente_nome: "Empresa XYZ Comércio Ltda",
    data_publicacao: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    conteudo: `SENTENÇA — 5ª Vara Cível de Manaus. Processo nº 0003456-78.2022.8.04.0001. Vistos etc. Trata-se de ação de cobrança c/c reparação de danos movida por Empresa XYZ Comércio Ltda em face de Construtora ABC S.A. (...) DISPOSITIVO: Ante o exposto, julgo PROCEDENTE o pedido para condenar a requerida ao pagamento da quantia de R$ 85.400,00 (oitenta e cinco mil e quatrocentos reais), acrescida de correção monetária pelo IPCA e juros de mora de 1% ao mês, desde a citação. Condeno ainda ao pagamento das custas e honorários advocatícios fixados em 15% do valor da condenação. Prazo para recurso de Apelação: 15 (quinze) dias. Cumpra-se. Manaus/AM, 18 de março de 2026.`,
    status: "nova",
    prazo_dias: 15,
    data_prazo: addDays(new Date(), 15).toISOString(),
  },
  {
    tipo: "intimacao",
    tribunal: "SEEU",
    numero_processo: "0002109-44.2021.8.04.0001",
    cliente_nome: "Pedro Augusto Ferreira",
    data_publicacao: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    conteudo: `INTIMAÇÃO — Vara de Execuções Penais da Comarca de Manaus — SEEU. Processo nº 0002109-44.2021.8.04.0001. Intima-se o patrono do apenado PEDRO AUGUSTO FERREIRA de que foi deferido o benefício de SAÍDA TEMPORÁRIA pelo período de 05 (cinco) dias a partir desta data. Outrossim, intime-se para que apresente relatório de acompanhamento do monitoramento eletrônico no prazo de 10 (dez) dias após o retorno. Cumpra-se. Manaus/AM, 18 de março de 2026.`,
    status: "lida",
    prazo_dias: 10,
    data_prazo: addDays(new Date(), 10).toISOString(),
  },
  {
    tipo: "acordao",
    tribunal: "TRF1",
    numero_processo: "1001234-55.2020.4.01.3200",
    cliente_nome: "José Roberto Lima",
    data_publicacao: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    conteudo: `ACÓRDÃO — Tribunal Regional Federal da 1ª Região — 1ª Turma. Processo nº 1001234-55.2020.4.01.3200. ADMINISTRATIVO. SERVIDOR PÚBLICO. REVISÃO DE APOSENTADORIA. INCORPORAÇÃO DE GRATIFICAÇÕES. DIREITO ADQUIRIDO. POSSIBILIDADE. RECURSO PROVIDO. (...) ACORDAM os membros da Primeira Turma do Tribunal Regional Federal da 1ª Região, por unanimidade, DAR PROVIMENTO à apelação do autor para reconhecer o direito à incorporação das gratificações pleiteadas nos termos do voto do relator. Honorários recursais majorados para 12% do valor da condenação. Data da sessão: 17/03/2026.`,
    status: "processada",
    prazo_dias: null,
    data_prazo: null,
    tarefa_gerada: true,
  },
  {
    tipo: "edital",
    tribunal: "TJAM",
    numero_processo: "0009871-11.2024.8.04.0001",
    cliente_nome: null,
    data_publicacao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    conteudo: `EDITAL DE CITAÇÃO — 7ª Vara Cível da Comarca de Manaus. O MM. Juiz de Direito da 7ª Vara Cível, no processo nº 0009871-11.2024.8.04.0001, FAZ SABER a todos que o presente edital, com prazo de 20 (vinte) dias, será afixado e publicado na forma da lei, ficando CITADO o réu NOME DESCONHECIDO (ou cujo endereço é ignorado) para responder à ação de usucapião. O não comparecimento implicará nomeação de curador especial. Manaus/AM, 16 de março de 2026.`,
    status: "lida",
    prazo_dias: 20,
    data_prazo: addDays(new Date(), 18).toISOString(),
  },
];

const Publicacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [filterStatus, setFilterStatus] = useState("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingCaptura, setLoadingCaptura] = useState(false);
  const [loadingTriage, setLoadingTriage] = useState<string | null>(null);
  const [triagemDialog, setTriagemDialog] = useState(false);
  const [triagemResult, setTriagemResult] = useState<{ pub: Publicacao; sugestao: string } | null>(null);
  const [tarefaForm, setTarefaForm] = useState({ titulo: "", prazo: "", prioridade: "alta" });
  const [criandoTarefa, setCriandoTarefa] = useState(false);

  const fetchPublicacoes = async () => {
    const { data } = await (supabase as any).from("publicacoes").select("*").order("data_publicacao", { ascending: false });
    if (data) setPublicacoes(data);
  };

  useEffect(() => { fetchPublicacoes(); }, []);

  const capturarPublicacoes = async () => {
    setLoadingCaptura(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({ title: "Sessão expirada. Faça login novamente.", variant: "destructive" });
        return;
      }

      let result: any = {};
      try {
        const resp = await fetch(CAPTURAR_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        });
        result = await resp.json();

        if (!resp.ok) {
          // Função não deployada ou erro no servidor — fallback gracioso
          if (publicacoes.length === 0) {
            await inserirDadosDemo();
          } else {
            toast({
              title: "Publicações já carregadas",
              description: "Integração com DataJud requer configuração no servidor. Suas publicações atuais estão disponíveis.",
            });
          }
          return;
        }
      } catch {
        // Erro de rede ou função indisponível — fallback para dados demo
        if (publicacoes.length === 0) {
          await inserirDadosDemo();
        } else {
          toast({
            title: "Publicações já carregadas",
            description: "Não foi possível conectar ao servidor. Suas publicações atuais estão disponíveis.",
          });
        }
        return;
      }

      if (result.capturadas > 0) {
        toast({
          title: `${result.capturadas} movimentação(ões) capturada(s)!`,
          description: result.message,
        });
        fetchPublicacoes();
      } else {
        const semProcessos = result.processosBuscados === 0 || result.processosBuscados === undefined;
        if (semProcessos && publicacoes.length === 0) {
          await inserirDadosDemo();
        } else {
          toast({
            title: "Consulta realizada",
            description: result.message || "Nenhuma movimentação nova encontrada.",
          });
        }
      }

      if (result.erros?.length > 0) {
        console.warn("Erros na captura:", result.erros);
      }
    } catch (err: any) {
      console.error("Erro inesperado:", err);
    } finally {
      setLoadingCaptura(false);
    }
  };

  const inserirDadosDemo = async () => {
    const inserts = MOCK_DATA.map((m) => ({
      ...m,
      user_id: user!.id,
      tarefa_gerada: m.tarefa_gerada || false,
      conteudo_simplificado: null,
    }));
    const { error } = await (supabase as any).from("publicacoes").insert(inserts);
    if (!error) {
      toast({ title: `${MOCK_DATA.length} publicações de demonstração inseridas`, description: "Cadastre processos reais para capturar dados do DataJud/CNJ." });
      fetchPublicacoes();
    }
  };

  const marcarComoLida = async (id: string) => {
    await (supabase as any).from("publicacoes").update({ status: "lida" }).eq("id", id);
    setPublicacoes((prev) => prev.map((p) => p.id === id ? { ...p, status: "lida" } : p));
  };

  const triarComIA = async (pub: Publicacao) => {
    setLoadingTriage(pub.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast({ title: "Sessão expirada", variant: "destructive" }); return; }

      const prompt = `Analise esta publicação judicial e responda de forma objetiva:

PUBLICAÇÃO:
Tribunal: ${pub.tribunal}
Processo: ${pub.numero_processo || "Não identificado"}
Cliente: ${pub.cliente_nome || "Não identificado"}
Tipo: ${tipoLabels[pub.tipo]?.label || pub.tipo}
Texto: ${pub.conteudo}

Responda no seguinte formato exato:
PRAZO: [número em dias ou "Sem prazo"]
URGÊNCIA: [ALTA/MÉDIA/BAIXA]
AÇÃO NECESSÁRIA: [descrição em 1 frase do que o advogado deve fazer]
TAREFA SUGERIDA: [título objetivo da tarefa a ser criada, ex: "Apresentar rol de testemunhas - Proc. 0001234"]
RESUMO SIMPLES: [explicação em 2-3 frases em linguagem simples para o cliente]`;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], mode: "assistente" }),
      });

      if (!response.ok) throw new Error("Erro na API de IA");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
            try {
              const json = JSON.parse(line.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) fullText += delta;
            } catch { /* ignore parse errors */ }
          }
        }
      }

      setTriagemResult({ pub, sugestao: fullText });

      // Pre-fill task form from AI response
      const tarefaMatch = fullText.match(/TAREFA SUGERIDA:\s*(.+)/);
      const prazoMatch = fullText.match(/PRAZO:\s*(\d+)/);
      const urgenciaMatch = fullText.match(/URGÊNCIA:\s*(ALTA|MÉDIA|BAIXA)/i);

      setTarefaForm({
        titulo: tarefaMatch ? tarefaMatch[1].trim() : `Verificar publicação — ${pub.numero_processo || pub.tribunal}`,
        prazo: prazoMatch ? format(addDays(new Date(), parseInt(prazoMatch[1])), "yyyy-MM-dd") : "",
        prioridade: urgenciaMatch ? (urgenciaMatch[1].toLowerCase() === "alta" ? "alta" : urgenciaMatch[1].toLowerCase() === "média" ? "media" : "baixa") : "alta",
      });

      setTriagemDialog(true);

      // Save simplified content
      const resumoMatch = fullText.match(/RESUMO SIMPLES:\s*([\s\S]+?)(?:$|(?=\n[A-Z]+:))/);
      if (resumoMatch) {
        await (supabase as any).from("publicacoes").update({ conteudo_simplificado: resumoMatch[1].trim(), status: "lida" }).eq("id", pub.id);
        fetchPublicacoes();
      }
    } catch (err) {
      toast({ title: "Erro na triagem", description: "Verifique se a IA está configurada.", variant: "destructive" });
    } finally {
      setLoadingTriage(null);
    }
  };

  const criarTarefa = async () => {
    if (!triagemResult || !tarefaForm.titulo.trim()) return;
    setCriandoTarefa(true);
    try {
      const { error } = await supabase.from("tarefas").insert({
        user_id: user!.id,
        titulo: tarefaForm.titulo,
        descricao: `Gerada automaticamente da publicação ${triagemResult.pub.tribunal} — Processo: ${triagemResult.pub.numero_processo || "N/A"}\n\nPublicação original:\n${triagemResult.pub.conteudo.slice(0, 500)}...`,
        prioridade: tarefaForm.prioridade,
        status: "pendente",
        data_limite: tarefaForm.prazo || null,
      });
      if (error) throw error;

      await (supabase as any).from("publicacoes").update({ tarefa_gerada: true, status: "processada" }).eq("id", triagemResult.pub.id);

      toast({ title: "Tarefa criada com sucesso!", description: tarefaForm.titulo });
      setTriagemDialog(false);
      setTriagemResult(null);
      fetchPublicacoes();
    } catch (err: any) {
      toast({ title: "Erro ao criar tarefa", description: err.message, variant: "destructive" });
    } finally {
      setCriandoTarefa(false);
    }
  };

  const filtered = useMemo(() => {
    return publicacoes.filter((p) => {
      const matchStatus = filterStatus === "todas" || p.status === filterStatus;
      const matchSearch = !searchQuery || [p.numero_processo, p.cliente_nome, p.tribunal, p.conteudo].some(
        (f) => f?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return matchStatus && matchSearch;
    });
  }, [publicacoes, filterStatus, searchQuery]);

  const counts = useMemo(() => ({
    todas: publicacoes.length,
    nova: publicacoes.filter((p) => p.status === "nova").length,
    urgente: publicacoes.filter((p) => p.status === "urgente").length,
    lida: publicacoes.filter((p) => p.status === "lida").length,
    processada: publicacoes.filter((p) => p.status === "processada").length,
  }), [publicacoes]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      nova: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      urgente: "bg-red-500/10 text-red-600 border-red-500/20",
      lida: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      processada: "bg-green-500/10 text-green-600 border-green-500/20",
    };
    const labels: Record<string, string> = { nova: "Nova", urgente: "Urgente", lida: "Lida", processada: "Processada" };
    return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] || ""}`}>{labels[status] || status}</span>;
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Publicações</h1>
            <p className="text-muted-foreground text-sm mt-1">Captura e triagem automática de publicações e intimações dos Diários de Justiça</p>
          </div>
          <Button onClick={capturarPublicacoes} disabled={loadingCaptura} className="gap-2">
            {loadingCaptura ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loadingCaptura ? "Capturando..." : "Capturar Publicações"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total", value: counts.todas, icon: Bell, color: "text-primary" },
            { label: "Novas", value: counts.nova, icon: Eye, color: "text-blue-600" },
            { label: "Urgentes", value: counts.urgente, icon: AlertTriangle, color: "text-red-600" },
            { label: "Lidas", value: counts.lida, icon: CheckCheck, color: "text-gray-500" },
            { label: "Processadas", value: counts.processada, icon: ListTodo, color: "text-green-600" },
          ].map((stat) => (
            <Card key={stat.label} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilterStatus(stat.label === "Total" ? "todas" : stat.label.toLowerCase())}>
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`w-4 h-4 shrink-0 ${stat.color}`} />
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Integration info when empty */}
        {publicacoes.length === 0 && (
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-[hsl(var(--info))]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Integração com Diários de Justiça</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Este módulo consulta a <strong>API pública DataJud/CNJ</strong> e captura movimentações reais dos seus processos cadastrados.
                    Clique em <strong>Capturar Publicações</strong> para buscar as últimas movimentações dos últimos 30 dias.
                    {" "}<span className="text-amber-600 font-medium">Para dados reais, cadastre seus processos no módulo Processos.</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["DataJud (CNJ)", "API PJe", "TJAM", "TRF1", "STJ", "STF", "SEEU", "Projudi"].map((api) => (
                      <span key={api} className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">{api}</span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por processo, cliente, tribunal..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tabs value={filterStatus} onValueChange={setFilterStatus}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="todas" className="text-xs">Todas <span className="ml-1 text-muted-foreground">({counts.todas})</span></TabsTrigger>
              <TabsTrigger value="urgente" className="text-xs text-red-600">Urgentes <span className="ml-1">({counts.urgente})</span></TabsTrigger>
              <TabsTrigger value="nova" className="text-xs">Novas <span className="ml-1 text-muted-foreground">({counts.nova})</span></TabsTrigger>
              <TabsTrigger value="lida" className="text-xs">Lidas <span className="ml-1 text-muted-foreground">({counts.lida})</span></TabsTrigger>
              <TabsTrigger value="processada" className="text-xs">Processadas <span className="ml-1 text-muted-foreground">({counts.processada})</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Publication List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {publicacoes.length === 0 ? "Nenhuma publicação capturada" : "Nenhuma publicação encontrada"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {publicacoes.length === 0
                ? "Clique em Capturar Publicações para simular a integração com os Diários de Justiça."
                : "Tente ajustar os filtros de busca."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((pub) => {
              const isExpanded = expandedId === pub.id;
              const tipoBadge = tipoLabels[pub.tipo] || tipoLabels.publicacao;
              const isUrgente = pub.status === "urgente";

              return (
                <Card
                  key={pub.id}
                  className={`transition-all ${isUrgente ? "border-red-500/30 bg-red-500/3" : ""}`}
                >
                  <CardContent className="p-0">
                    {/* Card Header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Icon */}
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isUrgente ? "bg-red-500/10" : "bg-primary/10"}`}>
                            <FileText className={`w-4 h-4 ${isUrgente ? "text-red-600" : "text-primary"}`} />
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tipoBadge.color}`}>{tipoBadge.label}</span>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">{pub.tribunal}</span>
                              {getStatusBadge(pub.status)}
                              {pub.tarefa_gerada && (
                                <span className="text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                  <ListTodo className="w-3 h-3" /> Tarefa criada
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                              {pub.numero_processo && (
                                <span className="flex items-center gap-1 font-medium text-foreground">
                                  <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                                  {pub.numero_processo}
                                </span>
                              )}
                              {pub.cliente_nome && (
                                <span className="text-muted-foreground text-xs">{pub.cliente_nome}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(pub.data_publicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {pub.prazo_dias !== null && pub.data_prazo && (
                                <span className={`text-xs flex items-center gap-1 ${isUrgente ? "text-red-600 font-semibold" : "text-orange-600"}`}>
                                  <Clock className="w-3 h-3" />
                                  Prazo: {pub.prazo_dias} dias ({format(new Date(pub.data_prazo), "dd/MM/yyyy")})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {pub.status !== "lida" && pub.status !== "processada" && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => marcarComoLida(pub.id)}>
                              <CheckCheck className="w-3.5 h-3.5" /> Lida
                            </Button>
                          )}
                          {!pub.tarefa_gerada && (
                            <Button
                              size="sm"
                              variant={isUrgente ? "default" : "outline"}
                              className="h-8 gap-1 text-xs"
                              onClick={() => triarComIA(pub)}
                              disabled={loadingTriage === pub.id}
                            >
                              {loadingTriage === pub.id
                                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                : <Bot className="w-3.5 h-3.5" />}
                              {loadingTriage === pub.id ? "Analisando..." : "Triagem IA"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setExpandedId(isExpanded ? null : pub.id)}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Content preview */}
                      {!isExpanded && (
                        <p className="text-xs text-muted-foreground mt-2 ml-12 line-clamp-2">
                          {pub.conteudo}
                        </p>
                      )}
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border/50 pt-3">
                        {pub.conteudo_simplificado && (
                          <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-semibold text-primary">Resumo em linguagem simples (Horus IA)</span>
                            </div>
                            <p className="text-sm text-foreground">{pub.conteudo_simplificado}</p>
                          </div>
                        )}
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Texto original da publicação</p>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{pub.conteudo}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Triagem Dialog */}
      <Dialog open={triagemDialog} onOpenChange={setTriagemDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Triagem Inteligente — Horus IA
            </DialogTitle>
          </DialogHeader>

          {triagemResult && (
            <div className="space-y-4">
              {/* AI Analysis */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Análise da IA</p>
                <p className="text-sm whitespace-pre-wrap text-foreground">{triagemResult.sugestao}</p>
              </div>

              {/* Publication info */}
              <div className="text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30">
                <p><strong>Tribunal:</strong> {triagemResult.pub.tribunal} | <strong>Tipo:</strong> {tipoLabels[triagemResult.pub.tipo]?.label} | <strong>Processo:</strong> {triagemResult.pub.numero_processo || "N/A"}</p>
              </div>

              {/* Task form */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-semibold">Criar tarefa a partir desta publicação</p>
                <div className="space-y-2">
                  <Label>Título da tarefa</Label>
                  <Input
                    value={tarefaForm.titulo}
                    onChange={(e) => setTarefaForm({ ...tarefaForm, titulo: e.target.value })}
                    placeholder="Ex: Apresentar rol de testemunhas"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data limite</Label>
                    <Input
                      type="date"
                      value={tarefaForm.prazo}
                      onChange={(e) => setTarefaForm({ ...tarefaForm, prazo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={tarefaForm.prioridade}
                      onChange={(e) => setTarefaForm({ ...tarefaForm, prioridade: e.target.value })}
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setTriagemDialog(false)}>Fechar</Button>
                <Button onClick={criarTarefa} disabled={criandoTarefa || !tarefaForm.titulo.trim()} className="gap-2">
                  {criandoTarefa ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ListTodo className="w-4 h-4" />}
                  {criandoTarefa ? "Criando..." : "Criar Tarefa"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Publicacoes;
