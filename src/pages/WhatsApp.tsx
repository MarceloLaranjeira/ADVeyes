import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Phone, Send, Copy, Users, Scale,
  CheckCircle, Clock, Calendar, FileText, Star, Smartphone,
  ExternalLink, History, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Cliente = { id: string; nome: string; telefone: string | null; email: string | null };
type Processo = { id: string; numero: string; area: string; status: string; cliente_nome: string | null };

type HistoryItem = {
  id: string;
  cliente_nome: string;
  phone: string;
  message: string;
  template: string;
  sent_at: string;
};

const TEMPLATES = [
  {
    id: "atualizacao_processo",
    label: "Atualização de Processo",
    icon: Scale,
    color: "bg-blue-500/10 text-blue-600",
    fields: ["processo_numero", "descricao_atualizacao"],
    generate: (data: Record<string, string>) =>
      `Olá, ${data.cliente_nome || "prezado(a)"}!\n\n📋 *Atualização do seu processo*\nNº ${data.processo_numero || "[número do processo]"}\n\n${data.descricao_atualizacao || "[descreva a atualização]"}\n\nQualquer dúvida, estou à disposição.\n\n_Albertino Advogados Associados_`,
  },
  {
    id: "lembrete_audiencia",
    label: "Lembrete de Audiência",
    icon: Calendar,
    color: "bg-orange-500/10 text-orange-600",
    fields: ["data_audiencia", "hora_audiencia", "local_audiencia"],
    generate: (data: Record<string, string>) =>
      `Olá, ${data.cliente_nome || "prezado(a)"}!\n\n⚖️ *Lembrete de Audiência*\n\n📅 Data: ${data.data_audiencia || "[data]"}\n⏰ Horário: ${data.hora_audiencia || "[hora]"}\n📍 Local: ${data.local_audiencia || "[local]"}\n\n⚠️ *Importante:* Por favor, chegue com 15 minutos de antecedência com documento de identidade.\n\nQualquer dúvida, entre em contato.\n\n_Albertino Advogados Associados_`,
  },
  {
    id: "solicitacao_documentos",
    label: "Solicitação de Documentos",
    icon: FileText,
    color: "bg-purple-500/10 text-purple-600",
    fields: ["lista_documentos", "prazo_entrega"],
    generate: (data: Record<string, string>) =>
      `Olá, ${data.cliente_nome || "prezado(a)"}!\n\n📎 *Documentos Necessários*\n\nPara dar continuidade ao seu processo, precisamos dos seguintes documentos:\n\n${data.lista_documentos || "• [documento 1]\n• [documento 2]\n• [documento 3]"}\n\n📅 Prazo: ${data.prazo_entrega || "[prazo]"}\n\nPode entregar pessoalmente no escritório ou enviar por este WhatsApp.\n\n_Albertino Advogados Associados_`,
  },
  {
    id: "confirmacao_pagamento",
    label: "Confirmação de Pagamento",
    icon: CheckCircle,
    color: "bg-green-500/10 text-green-600",
    fields: ["valor_honorario", "data_vencimento"],
    generate: (data: Record<string, string>) =>
      `Olá, ${data.cliente_nome || "prezado(a)"}!\n\n💰 *Honorários Advocatícios*\n\nInformamos que há uma parcela de honorários em aberto:\n\n💵 Valor: R$ ${data.valor_honorario || "[valor]"}\n📅 Vencimento: ${data.data_vencimento || "[data]"}\n\nPara pagamento via *PIX*:\nChave: albertino@advogados.com.br\n\nApós o pagamento, envie o comprovante por este WhatsApp.\n\nAgradeço a atenção!\n\n_Albertino Advogados Associados_`,
  },
  {
    id: "primeiro_contato",
    label: "Boas-vindas / Primeiro Contato",
    icon: Star,
    color: "bg-yellow-500/10 text-yellow-600",
    fields: ["area_juridica"],
    generate: (data: Record<string, string>) =>
      `Olá, ${data.cliente_nome || "prezado(a)"}!\n\n🤝 Seja bem-vindo(a) ao *Albertino Advogados Associados*.\n\nSou o Dr. Albertino e ficarei responsável pelo seu caso na área de *${data.area_juridica || "Direito"}*.\n\nEm breve entraremos em contato para agendar uma consulta detalhada. Estou à sua disposição para quaisquer dúvidas iniciais.\n\n📍 Nosso escritório fica localizado em Manaus/AM.\n📅 Atendimentos de segunda a sexta, das 8h às 18h.\n\n_Albertino Advogados Associados_`,
  },
  {
    id: "prazo_recurso",
    label: "Alerta de Prazo / Recurso",
    icon: Clock,
    color: "bg-red-500/10 text-red-600",
    fields: ["tipo_recurso", "data_prazo"],
    generate: (data: Record<string, string>) =>
      `Olá, ${data.cliente_nome || "prezado(a)"}!\n\n⚠️ *Alerta Importante — Prazo Processual*\n\nTemos um prazo processual se aproximando:\n\n📋 Tipo: ${data.tipo_recurso || "[tipo de recurso/prazo]"}\n📅 Prazo final: ${data.data_prazo || "[data]"}\n\nJá estamos trabalhando para garantir que tudo seja cumprido no prazo.\n\nVocê será informado(a) sobre o andamento.\n\n_Albertino Advogados Associados_`,
  },
];

const WhatsApp = () => {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [customPhone, setCustomPhone] = useState("");
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({});
  const [customMessage, setCustomMessage] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("clientes").select("id, nome, telefone, email").order("nome"),
      supabase.from("processos").select("id, numero, area, status, cliente_nome").order("created_at", { ascending: false }),
    ]).then(([c, p]) => {
      if (c.data) setClientes(c.data);
      if (p.data) setProcessos(p.data);
    });

    const stored = localStorage.getItem("whatsapp_history");
    if (stored) setHistory(JSON.parse(stored));
  }, []);

  const cliente = clientes.find((c) => c.id === selectedCliente);
  const template = TEMPLATES.find((t) => t.id === selectedTemplate)!;

  const getPhone = () => {
    const phone = customPhone || cliente?.telefone || "";
    return phone.replace(/\D/g, "");
  };

  const getClienteNome = () => cliente?.nome || templateFields.cliente_nome || "";

  const getPreviewMessage = () => {
    if (isCustom) return customMessage;
    const data = { ...templateFields, cliente_nome: getClienteNome() };
    return template.generate(data);
  };

  const previewMessage = getPreviewMessage();

  const openWhatsApp = () => {
    const phone = getPhone();
    if (!phone || phone.length < 10) {
      toast({ title: "Informe um número de telefone válido", variant: "destructive" });
      return;
    }
    const encodedMsg = encodeURIComponent(previewMessage);
    const url = `https://wa.me/55${phone}?text=${encodedMsg}`;
    window.open(url, "_blank");

    // Save to history
    const item: HistoryItem = {
      id: Date.now().toString(),
      cliente_nome: getClienteNome() || phone,
      phone: `55${phone}`,
      message: previewMessage.slice(0, 200),
      template: isCustom ? "Mensagem personalizada" : template.label,
      sent_at: new Date().toISOString(),
    };
    const newHistory = [item, ...history].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem("whatsapp_history", JSON.stringify(newHistory));

    toast({ title: "WhatsApp aberto!", description: "A mensagem foi carregada no WhatsApp." });
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(previewMessage);
    toast({ title: "Mensagem copiada!" });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("whatsapp_history");
  };

  const clienteProcessos = processos.filter((p) => p.cliente_nome === cliente?.nome);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-green-600" />
              WhatsApp
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Hub de comunicação via WhatsApp com clientes</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-4 h-4" />
            Histórico ({history.length})
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* History Panel */}
        {showHistory && (
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold font-serif">Mensagens Recentes</h3>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" className="gap-1 text-destructive h-7" onClick={clearHistory}>
                    <Trash2 className="w-3.5 h-3.5" /> Limpar
                  </Button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mensagem enviada ainda.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{item.cliente_nome}</p>
                          <span className="text-xs text-muted-foreground">{format(new Date(item.sent_at), "dd/MM HH:mm")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.template} · +{item.phone}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Compose */}
          <div className="space-y-4">
            {/* Client selector */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold font-serif">Destinatário</h3>
                </div>

                <div className="space-y-2">
                  <Label>Selecionar Cliente</Label>
                  <Select value={selectedCliente} onValueChange={(v) => { setSelectedCliente(v); setTemplateFields({}); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um cliente cadastrado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            {c.nome}
                            {c.telefone && <span className="text-xs text-muted-foreground">({c.telefone})</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Número de Telefone</Label>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md border">+55</span>
                    <Input
                      placeholder={cliente?.telefone || "(92) 99999-9999"}
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  {cliente?.telefone && !customPhone && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Telefone do cliente: {cliente.telefone}
                    </p>
                  )}
                </div>

                {/* Client processes */}
                {selectedCliente && clienteProcessos.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Processos do Cliente</Label>
                    <div className="space-y-1">
                      {clienteProcessos.slice(0, 3).map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-xs bg-muted/40 px-2 py-1.5 rounded">
                          <Scale className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{p.numero}</span>
                          <span className="text-muted-foreground">— {p.area}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 ml-auto text-xs"
                            onClick={() => setTemplateFields((prev) => ({ ...prev, processo_numero: p.numero }))}
                          >
                            Usar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template Selector */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold font-serif">Modelo de Mensagem</h3>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <button
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!isCustom ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}
                    onClick={() => setIsCustom(false)}
                  >
                    Usar Modelo
                  </button>
                  <button
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isCustom ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}
                    onClick={() => setIsCustom(true)}
                  >
                    Mensagem Livre
                  </button>
                </div>

                {!isCustom ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {TEMPLATES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.id}
                            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all text-xs ${
                              selectedTemplate === t.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                            onClick={() => { setSelectedTemplate(t.id); setTemplateFields({}); }}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-medium leading-tight">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Template Fields */}
                    {template.fields.length > 0 && (
                      <div className="space-y-3 pt-3 border-t">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preencher campos</p>
                        {template.fields.map((field) => {
                          const labels: Record<string, string> = {
                            processo_numero: "Número do Processo",
                            descricao_atualizacao: "Descrição da Atualização",
                            data_audiencia: "Data da Audiência",
                            hora_audiencia: "Horário",
                            local_audiencia: "Local",
                            lista_documentos: "Lista de Documentos",
                            prazo_entrega: "Prazo para Entrega",
                            valor_honorario: "Valor (R$)",
                            data_vencimento: "Data de Vencimento",
                            area_juridica: "Área Jurídica",
                            tipo_recurso: "Tipo de Recurso/Prazo",
                            data_prazo: "Data do Prazo",
                          };
                          const isTextarea = ["descricao_atualizacao", "lista_documentos"].includes(field);
                          return (
                            <div key={field} className="space-y-1.5">
                              <Label className="text-xs">{labels[field] || field}</Label>
                              {isTextarea ? (
                                <Textarea
                                  className="text-sm min-h-[70px]"
                                  placeholder={`Informe ${labels[field]?.toLowerCase() || field}...`}
                                  value={templateFields[field] || ""}
                                  onChange={(e) => setTemplateFields((prev) => ({ ...prev, [field]: e.target.value }))}
                                />
                              ) : (
                                <Input
                                  className="text-sm h-9"
                                  placeholder={`Informe ${labels[field]?.toLowerCase() || field}...`}
                                  value={templateFields[field] || ""}
                                  onChange={(e) => setTemplateFields((prev) => ({ ...prev, [field]: e.target.value }))}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Textarea
                    className="min-h-[200px] text-sm"
                    placeholder="Digite sua mensagem personalizada..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview + Send */}
          <div className="space-y-4">
            {/* WhatsApp Preview */}
            <Card className="border-green-500/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {getClienteNome() || "Cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getPhone() ? `+55 ${getPhone().slice(0, 2)} ${getPhone().slice(2, 7)}-${getPhone().slice(7)}` : "Número não informado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">Online</span>
                  </div>
                </div>

                {/* Chat bubble */}
                <div className="bg-muted/30 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                  <div className="flex justify-end">
                    <div className="bg-green-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {previewMessage || <span className="opacity-60 italic">Selecione um modelo e preencha os campos...</span>}
                      </p>
                      <p className="text-[10px] text-white/70 text-right mt-1">
                        {format(new Date(), "HH:mm")} ✓✓
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Prévia da mensagem que será enviada via WhatsApp
                </p>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <Button
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={openWhatsApp}
                  disabled={!previewMessage.trim() || !getPhone()}
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir no WhatsApp Web
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={copyMessage}
                  disabled={!previewMessage.trim()}
                >
                  <Copy className="w-4 h-4" />
                  Copiar Mensagem
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  O WhatsApp será aberto com a mensagem pronta para envio.
                  Você ainda precisará confirmar o envio no app.
                </p>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold">Dicas de Uso</p>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Selecione o cliente para preencher automaticamente o nome e telefone</li>
                  <li>• Use os processos do cliente para preencher o número do processo</li>
                  <li>• Para WhatsApp Business, configure um número comercial para maior credibilidade</li>
                  <li>• As mensagens enviadas ficam salvas no histórico local do navegador</li>
                  <li>• Use "Mensagem Livre" para comunicações não contempladas nos modelos</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default WhatsApp;
