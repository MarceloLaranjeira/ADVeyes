import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Bot, Sparkles, MessageSquare, FileSearch, Send, Loader2,
  Mic, MicOff, Volume2, VolumeX, Settings2, ChevronDown,
  Scale, X, ChevronRight, Languages, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string; timestamp?: number };
type TtsProvider = "browser" | "elevenlabs" | "openai" | "google";
type VoiceState = "idle" | "listening" | "speaking" | "processing";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const modes = [
  { value: "assistente", label: "Assistente Jurídico", icon: Bot, desc: "Legislação e jurisprudência" },
  { value: "resumo", label: "Resumo de Peças", icon: MessageSquare, desc: "Petições, sentenças, acórdãos" },
  { value: "analise", label: "Análise de Documentos", icon: FileSearch, desc: "Contratos e documentos" },
  { value: "peticao", label: "Geração de Peças", icon: Sparkles, desc: "Petições e recursos" },
  { value: "traducao", label: "Tradutor Jurídico", icon: Languages, desc: "Juridiquês para linguagem simples" },
  { value: "triagem", label: "Triagem de Leads", icon: UserCheck, desc: "Qualificação de clientes potenciais" },
];

const openaiVoices = ["alloy", "nova", "echo", "fable", "onyx", "shimmer"];

const ttsProviderLabels: Record<string, string> = {
  browser: "Navegador",
  elevenlabs: "ElevenLabs",
  openai: "OpenAI TTS",
  google: "Google TTS",
};

// ---- TTS ENGINE ----
class HorusTTS {
  private provider: TtsProvider;
  private apiKey: string;
  private voice: string;
  private synth: SpeechSynthesis | null;

  constructor(provider: TtsProvider, apiKey: string, voice = "nova") {
    this.provider = provider;
    this.apiKey = apiKey;
    this.voice = voice;
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  }

  stop() {
    if (this.synth) this.synth.cancel();
  }

  async speak(text: string, onEnd?: () => void): Promise<void> {
    this.stop();
    const clean = text.replace(/[*_`#>]/g, "").trim();
    if (!clean) { onEnd?.(); return; }

    if (this.provider === "browser") return this.speakBrowser(clean, onEnd);
    if (this.provider === "elevenlabs" && this.apiKey) return this.speakElevenLabs(clean, onEnd);
    if (this.provider === "openai" && this.apiKey) return this.speakOpenAI(clean, onEnd);
    if (this.provider === "google" && this.apiKey) return this.speakGoogle(clean, onEnd);
    return this.speakBrowser(clean, onEnd);
  }

  private speakBrowser(text: string, onEnd?: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) { onEnd?.(); resolve(); return; }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "pt-BR";
      utter.rate = 1.05;
      utter.pitch = 0.9;
      const voices = this.synth.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith("pt")) || voices[0];
      if (ptVoice) utter.voice = ptVoice;
      utter.onend = () => { onEnd?.(); resolve(); };
      utter.onerror = () => { onEnd?.(); resolve(); };
      this.synth.speak(utter);
    });
  }

  private async speakElevenLabs(text: string, onEnd?: () => void): Promise<void> {
    try {
      const voiceId = this.voice || "21m00Tcm4TlvDq8ikWAM";
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: "POST",
        headers: { "xi-api-key": this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (!resp.ok) throw new Error("ElevenLabs error");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
      audio.play();
    } catch {
      this.speakBrowser(text, onEnd);
    }
  }

  private async speakOpenAI(text: string, onEnd?: () => void): Promise<void> {
    try {
      const resp = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "tts-1", input: text, voice: this.voice || "nova", response_format: "mp3" }),
      });
      if (!resp.ok) throw new Error("OpenAI TTS error");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
      audio.play();
    } catch {
      this.speakBrowser(text, onEnd);
    }
  }

  private async speakGoogle(text: string, onEnd?: () => void): Promise<void> {
    try {
      const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: "pt-BR", name: "pt-BR-Wavenet-D" },
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.05 },
        }),
      });
      if (!resp.ok) throw new Error("Google TTS error");
      const { audioContent } = await resp.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audio.onended = () => { onEnd?.(); };
      audio.play();
    } catch {
      this.speakBrowser(text, onEnd);
    }
  }
}

// ---- MAIN COMPONENT ----
const IAJuridica = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("assistente");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [ttsEnabled, setTtsEnabled] = useState(() => sessionStorage.getItem("horus_tts_enabled") !== "false");
  const [ttsProvider] = useState<TtsProvider>(() => (sessionStorage.getItem("horus_tts_provider") as TtsProvider) || "browser");
  const [ttsApiKey] = useState(() => sessionStorage.getItem("horus_tts_key") || "");
  const [ttsVoice] = useState(() => sessionStorage.getItem("horus_tts_voice") || "nova");
  const [showSettings, setShowSettings] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showModePanel, setShowModePanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const ttsRef = useRef<HorusTTS | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ttsRef.current = new HorusTTS(ttsProvider, ttsApiKey, ttsVoice);
  }, [ttsProvider, ttsApiKey, ttsVoice]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initRecognition = useCallback(() => {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setVoiceState("listening");
    recognition.onresult = (e: Event & { results: SpeechRecognitionResultList }) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        setInput(t);
        setTranscript("");
      }
    };
    recognition.onend = () => { setVoiceState("idle"); setTranscript(""); };
    recognition.onerror = () => { setVoiceState("idle"); setTranscript(""); };
    return recognition;
  }, []);

  const toggleVoice = () => {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Voz não suportada", description: "Use Chrome ou Edge.", variant: "destructive" });
      return;
    }
    if (voiceState === "listening") { recognitionRef.current?.stop(); setVoiceState("idle"); return; }
    if (voiceState === "speaking") { ttsRef.current?.stop(); setVoiceState("idle"); return; }
    ttsRef.current?.stop();
    const r = initRecognition();
    if (!r) return;
    recognitionRef.current = r;
    try { r.start(); } catch { /* already started */ }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setVoiceState("processing");

    try {
      // Use authenticated session token — never expose anon key as bearer
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages: newMessages, mode }),
      });

      if (resp.status === 429) {
        toast({ title: "Limite excedido", description: "Tente novamente em instantes.", variant: "destructive" });
        setIsLoading(false); setVoiceState("idle"); return;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", variant: "destructive" });
        setIsLoading(false); setVoiceState("idle"); return;
      }
      if (!resp.ok || !resp.body) throw new Error("Falha ao conectar com Horus");

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
                if (last?.role === "assistant")
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                return [...prev, { role: "assistant", content: assistantText, timestamp: Date.now() }];
              });
            }
          } catch { /* partial chunk */ }
        }
      }

      if (ttsEnabled && assistantText) {
        setVoiceState("speaking");
        await ttsRef.current?.speak(assistantText, () => setVoiceState("idle"));
      } else {
        setVoiceState("idle");
      }
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
      setVoiceState("idle");
    }
    setIsLoading(false);
  };

  const currentMode = modes.find(m => m.value === mode)!;
  const statusLabel = voiceState === "listening" ? "Ouvindo" : voiceState === "speaking" ? "Respondendo" : voiceState === "processing" ? "Processando" : "Online";

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] rounded-xl overflow-hidden border bg-card">

        {/* HEADER */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
            voiceState === "idle" ? "bg-primary/10 border-primary/20" :
            voiceState === "listening" ? "bg-destructive/10 border-destructive/30" :
            voiceState === "speaking" ? "bg-warning/10 border-warning/30" :
            "bg-primary/10 border-primary/20"
          }`}>
            <Scale className="w-4 h-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wider text-foreground">HORUS</span>
              <span className="text-xs text-muted-foreground">IA Jurídica</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                voiceState === "idle" ? "bg-success/10 text-[hsl(var(--success))]" :
                voiceState === "listening" ? "bg-destructive/10 text-destructive" :
                voiceState === "speaking" ? "bg-warning/10 text-[hsl(var(--warning))]" :
                "bg-muted text-muted-foreground"
              }`}>
                {statusLabel}
              </span>
              {transcript && <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">"{transcript}"</span>}
            </div>
            <p className="text-[10px] text-muted-foreground">Modo: {currentMode.label}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowModePanel(!showModePanel)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <currentMode.icon className="w-3.5 h-3.5" />
              <ChevronDown className={`w-3 h-3 transition-transform ${showModePanel ? "rotate-180" : ""}`} />
            </button>

            <button
              onClick={() => { setTtsEnabled(v => !v); ttsRef.current?.stop(); localStorage.setItem("horus_tts_enabled", String(!ttsEnabled)); }}
              className={`p-1.5 rounded-lg border transition-all ${ttsEnabled ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              title={ttsEnabled ? "Desligar voz" : "Ligar voz"}
            >
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setShowSettings(v => !v)}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* MODE PANEL */}
        {showModePanel && (
          <div className="border-b bg-muted/30 p-3 grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => { setMode(m.value); setShowModePanel(false); }}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all ${
                  mode === m.value
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <m.icon className="w-3.5 h-3.5 shrink-0" />
                <div>
                  <p className="font-medium leading-tight">{m.label}</p>
                  <p className="text-[10px] opacity-60">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* SETTINGS PANEL */}
        {showSettings && (
          <div className="border-b bg-muted/30 p-4 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground">Configurações de Voz (TTS)</p>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure o provedor de voz em{" "}
              <a href="/configuracoes" className="text-primary underline-offset-2 hover:underline">
                Configurações → Voz & IA
              </a>
              . Provedor atual: <span className="font-medium text-foreground">{ttsProviderLabels[ttsProvider] || ttsProvider}</span>.
            </p>
          </div>
        )}

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 py-12 text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Scale className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-serif text-foreground">Horus — IA Jurídica</h2>
                <p className="text-sm text-muted-foreground mt-1">Assistente de inteligência artificial para advocacia.<br />Digite ou fale para começar.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {[
                  "Analise este contrato de prestação de serviços",
                  "Quais os prazos para recurso em processo penal?",
                  "Gere uma petição inicial de indenização por danos morais",
                  "Resumo da lei 13.105 (CPC)",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="flex items-start gap-2 p-3 rounded-lg border bg-card text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted hover:border-primary/30 transition-all"
                  >
                    <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Scale className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm border"
              }`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 w-7 h-7 rounded-lg bg-muted border flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground">EU</span>
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2.5 justify-start">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Scale className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted border rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block animate-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="border-t bg-card p-3 shrink-0">
          <div className="flex gap-2 items-end">
            <button
              onClick={toggleVoice}
              className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                voiceState === "listening" ? "bg-destructive/10 border-destructive/40 text-destructive" :
                voiceState === "speaking" ? "bg-warning/10 border-warning/40 text-[hsl(var(--warning))]" :
                "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={voiceState === "listening" ? "Parar" : voiceState === "speaking" ? "Parar fala" : "Voz"}
            >
              {voiceState === "listening" ? <MicOff className="w-4 h-4" /> :
               voiceState === "speaking" ? <VolumeX className="w-4 h-4" /> :
               <Mic className="w-4 h-4" />}
            </button>

            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voiceState === "listening" ? "Ouvindo... fale agora" :
                voiceState === "speaking" ? "Horus está respondendo..." :
                "Digite sua pergunta jurídica..."
              }
              className="min-h-[38px] max-h-[120px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />

            <Button
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="shrink-0 h-9 w-9"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <p className="text-[10px] text-muted-foreground">
              Enter para enviar · Shift+Enter para nova linha
            </p>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); ttsRef.current?.stop(); setVoiceState("idle"); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar conversa
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default IAJuridica;
