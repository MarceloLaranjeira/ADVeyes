import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Bot, Send, Loader2, Mic, MicOff, Volume2, VolumeX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };
type TtsProvider = "browser" | "elevenlabs" | "openai" | "google";
type VoiceState = "idle" | "listening" | "speaking" | "processing";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const MODES = [
  { value: "assistente", label: "Assistente" },
  { value: "resumo", label: "Resumo" },
  { value: "analise", label: "Análise" },
  { value: "peticao", label: "Petição" },
];

const SUGGESTIONS = [
  "Quais os prazos para recurso de apelação?",
  "Analise este contrato de prestação de serviços",
  "Gere petição inicial por danos morais",
  "Como funciona a usucapião extrajudicial?",
];

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

  stop() { this.synth?.cancel(); }

  async speak(text: string, onEnd?: () => void): Promise<void> {
    this.stop();
    const clean = text.replace(/[*_`#>]/g, "").trim().slice(0, 800);
    if (!clean) { onEnd?.(); return; }
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
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
      audio.play();
    } catch { this.speakBrowser(text, onEnd); }
  }

  private async speakOpenAI(text: string, onEnd?: () => void): Promise<void> {
    try {
      const resp = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "tts-1", input: text, voice: this.voice || "nova", response_format: "mp3" }),
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
      audio.play();
    } catch { this.speakBrowser(text, onEnd); }
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
      if (!resp.ok) throw new Error();
      const { audioContent } = await resp.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audio.onended = () => { onEnd?.(); };
      audio.play();
    } catch { this.speakBrowser(text, onEnd); }
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
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const ttsRef = useRef<HorusTTS | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    const p = localStorage.getItem("jarvis_tts_provider") as TtsProvider || "browser";
    const k = localStorage.getItem("jarvis_tts_key") || "";
    const v = localStorage.getItem("jarvis_tts_voice") || "nova";
    ttsRef.current = new HorusTTS(p, k, v);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = "pt-BR";
    r.interimResults = true;
    r.continuous = false;
    r.onstart = () => setVoiceState("listening");
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        setInput(t);
        setTranscript("");
      }
    };
    r.onend = () => { setVoiceState("idle"); setTranscript(""); };
    r.onerror = () => { setVoiceState("idle"); setTranscript(""); };
    return r;
  }, []);

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Microfone não suportado", description: "Use Chrome ou Edge.", variant: "destructive" });
      return;
    }
    if (voiceState === "listening") { recognitionRef.current?.stop(); return; }
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
    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setVoiceState("processing");

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, mode }),
      });

      if (resp.status === 429) {
        toast({ title: "Limite excedido", description: "Aguarde um instante.", variant: "destructive" });
        setIsLoading(false); setVoiceState("idle"); return;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", variant: "destructive" });
        setIsLoading(false); setVoiceState("idle"); return;
      }
      if (!resp.ok || !resp.body) throw new Error("Falha ao conectar com HORUS");

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
                return [...prev, { role: "assistant", content: assistantText }];
              });
            }
          } catch { /* partial */ }
        }
      }

      if (ttsEnabled && assistantText) {
        setVoiceState("speaking");
        await ttsRef.current?.speak(assistantText, () => setVoiceState("idle"));
      } else {
        setVoiceState("idle");
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setVoiceState("idle");
    }
    setIsLoading(false);
  };

  const orbClass = voiceState === "listening"
    ? "ring-red-400 bg-red-500/10"
    : voiceState === "speaking"
    ? "ring-amber-400 bg-amber-500/10"
    : voiceState === "processing"
    ? "ring-blue-400/60 bg-blue-500/10 animate-pulse"
    : "ring-cyan-500/40 bg-cyan-500/5";

  const statusLabel = voiceState === "listening" ? "Ouvindo..."
    : voiceState === "speaking" ? "Falando..."
    : voiceState === "processing" ? "Processando..."
    : "Online";

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[hsl(222,55%,7%)] rounded-xl border border-white/8 overflow-hidden">

        {/* HEADER */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 shrink-0">
          <div className={`relative w-9 h-9 rounded-full ring-2 flex items-center justify-center transition-all ${orbClass}`}>
            <Bot className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-widest">HORUS</h1>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">{statusLabel}</span>
              {transcript && <span className="text-[11px] text-red-400 italic">"{transcript}"</span>}
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === m.value
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* TTS toggle */}
          <button
            onClick={() => { setTtsEnabled(v => !v); ttsRef.current?.stop(); }}
            className={`p-2 rounded-lg transition-colors ${ttsEnabled ? "text-amber-400 bg-amber-500/10" : "text-white/25 hover:text-white/50"}`}
            title={ttsEnabled ? "Silenciar" : "Ativar voz"}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); ttsRef.current?.stop(); setVoiceState("idle"); }}
              className="p-2 rounded-lg text-white/25 hover:text-white/60 transition-colors"
              title="Limpar conversa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-8">
              {/* HORUS orb */}
              <div className="relative">
                <div className={`w-20 h-20 rounded-full ring-2 flex items-center justify-center ${orbClass}`}>
                  <Bot className="w-9 h-9 text-cyan-400" />
                </div>
                <div className="absolute inset-0 rounded-full ring-1 ring-cyan-500/15 scale-125 animate-pulse" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-widest mb-1">HORUS</h2>
                <p className="text-sm text-white/40">Agente jurídico — direto ao ponto</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-left p-3 rounded-lg bg-white/4 border border-white/8 text-xs text-white/50 hover:text-white/80 hover:bg-white/8 hover:border-cyan-500/30 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-cyan-500/15 ring-1 ring-cyan-500/30 flex items-center justify-center mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                </div>
              )}
              <div className={`max-w-[78%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === "user"
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-100 rounded-tr-sm"
                  : "bg-white/6 border border-white/10 text-white/85 rounded-tl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-cyan-500/15 ring-1 ring-cyan-500/30 flex items-center justify-center animate-pulse">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="bg-white/6 border border-white/10 rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 inline-block animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="px-5 py-4 border-t border-white/8 shrink-0">
          <div className="flex gap-2 items-end">
            <button
              onClick={toggleVoice}
              className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                voiceState === "listening"
                  ? "bg-red-500/20 ring-1 ring-red-400/50 text-red-400"
                  : voiceState === "speaking"
                  ? "bg-amber-500/20 ring-1 ring-amber-400/50 text-amber-400"
                  : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10"
              }`}
              title="Comando de voz"
            >
              {voiceState === "listening" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voiceState === "listening" ? "Ouvindo... fale agora" :
                voiceState === "speaking" ? "HORUS está respondendo..." :
                "Pergunte algo..."
              }
              className="flex-1 min-h-[42px] max-h-[120px] resize-none bg-white/5 border-white/12 text-white/85 placeholder-white/25 focus:border-cyan-500/40 focus:ring-0 rounded-lg text-sm transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />

            <Button
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-10 w-10 p-0 rounded-lg bg-cyan-600 hover:bg-cyan-500 border-0 disabled:opacity-30 transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-white/20 mt-1.5 pl-1">Enter para enviar · Shift+Enter para nova linha · Voz TTS em Configurações</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default IAJuridica;
