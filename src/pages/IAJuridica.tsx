import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Sparkles, MessageSquare, FileSearch, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const modes = [
  { value: "assistente", label: "Assistente Jurídico", icon: Bot, desc: "Tire dúvidas sobre legislação e jurisprudência" },
  { value: "resumo", label: "Resumo de Peças", icon: MessageSquare, desc: "Resuma petições, sentenças e acórdãos" },
  { value: "analise", label: "Análise de Documentos", icon: FileSearch, desc: "Analise contratos e documentos jurídicos" },
  { value: "peticao", label: "Geração de Peças", icon: Sparkles, desc: "Gere rascunhos de petições e recursos" },
];

const IAJuridica = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("assistente");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, mode }),
      });

      if (resp.status === 429) { toast({ title: "Limite excedido", description: "Tente novamente em instantes.", variant: "destructive" }); setIsLoading(false); return; }
      if (resp.status === 402) { toast({ title: "Créditos insuficientes", variant: "destructive" }); setIsLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Falha ao conectar com IA");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                return [...prev, { role: "assistant", content: assistantText }];
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <AppLayout>
      <div className="animate-fade-in flex flex-col h-[calc(100vh-4rem)]">
        <div className="mb-4">
          <h1 className="text-3xl font-bold font-serif">IA Jurídica</h1>
          <p className="text-muted-foreground text-sm mt-1">Inteligência artificial aplicada à prática jurídica</p>
        </div>

        {messages.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {modes.map((m) => (
              <Card key={m.value} className={`cursor-pointer hover:shadow-md transition-shadow ${mode === m.value ? "ring-2 ring-primary" : ""}`} onClick={() => setMode(m.value)}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <m.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{m.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3"><Loader2 className="w-4 h-4 animate-spin" /></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{modes.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Gemini 3 Flash</span>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta jurídica..."
              className="min-h-[60px] max-h-[120px]"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <Button onClick={send} disabled={!input.trim() || isLoading} className="self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default IAJuridica;
