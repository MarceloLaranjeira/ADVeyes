import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Bot, Sparkles, MessageSquare, FileSearch, Send, Loader2,
  Mic, MicOff, Volume2, VolumeX, Settings2, ChevronDown,
  Zap, Brain, Scale, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type Msg = { role: "user" | "assistant"; content: string; timestamp?: number };
type TtsProvider = "browser" | "elevenlabs" | "openai" | "google";
type VoiceState = "idle" | "listening" | "speaking" | "processing";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const modes = [
  { value: "assistente", label: "Assistente Jurídico", icon: Bot, desc: "Legislação e jurisprudência" },
  { value: "resumo", label: "Resumo de Peças", icon: MessageSquare, desc: "Petições, sentenças, acórdãos" },
  { value: "analise", label: "Análise de Documentos", icon: FileSearch, desc: "Contratos e documentos" },
  { value: "peticao", label: "Geração de Peças", icon: Sparkles, desc: "Petições e recursos" },
];

const ttsProviders = [
  { value: "browser", label: "Navegador (Nativo)", desc: "Rápido, offline, sem custo" },
  { value: "elevenlabs", label: "ElevenLabs", desc: "Voz ultra-realista" },
  { value: "openai", label: "OpenAI TTS", desc: "Alloy / Nova / Echo" },
  { value: "google", label: "Google Cloud TTS", desc: "WaveNet voices" },
];

const openaiVoices = ["alloy", "nova", "echo", "fable", "onyx", "shimmer"];

// ---- TTS ENGINE ----
class JarvisTTS {
  private provider: TtsProvider;
  private apiKey: string;
  private voice: string;
  private synth: SpeechSynthesis | null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(provider: TtsProvider, apiKey: string, voice = "alloy") {
    this.provider = provider;
    this.apiKey = apiKey;
    this.voice = voice;
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  }

  stop() {
    if (this.synth) this.synth.cancel();
    this.currentUtterance = null;
  }

  async speak(text: string, onEnd?: () => void): Promise<void> {
    this.stop();
    const clean = text.replace(/[*_`#>]/g, "").trim();
    if (!clean) { onEnd?.(); return; }

    if (this.provider === "browser") {
      return this.speakBrowser(clean, onEnd);
    } else if (this.provider === "elevenlabs" && this.apiKey) {
      return this.speakElevenLabs(clean, onEnd);
    } else if (this.provider === "openai" && this.apiKey) {
      return this.speakOpenAI(clean, onEnd);
    } else if (this.provider === "google" && this.apiKey) {
      return this.speakGoogle(clean, onEnd);
    } else {
      return this.speakBrowser(clean, onEnd);
    }
  }

  private speakBrowser(text: string, onEnd?: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) { onEnd?.(); resolve(); return; }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "pt-BR";
      utter.rate = 1.05;
      utter.pitch = 0.9;
      utter.volume = 1;
      const voices = this.synth.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith("pt")) || voices[0];
      if (ptVoice) utter.voice = ptVoice;
      utter.onend = () => { onEnd?.(); resolve(); };
      utter.onerror = () => { onEnd?.(); resolve(); };
      this.currentUtterance = utter;
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
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("browser");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsVoice, setTtsVoice] = useState("nova");
  const [showSettings, setShowSettings] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showModePanel, setShowModePanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const ttsRef = useRef<JarvisTTS | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep TTS engine in sync
  useEffect(() => {
    ttsRef.current = new JarvisTTS(ttsProvider, ttsApiKey, ttsVoice);
  }, [ttsProvider, ttsApiKey, ttsVoice]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Init speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setVoiceState("listening");
    recognition.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        setInput(t);
        setTranscript("");
      }
    };
    recognition.onend = () => {
      setVoiceState("idle");
      setTranscript("");
    };
    recognition.onerror = () => {
      setVoiceState("idle");
      setTranscript("");
    };
    return recognition;
  }, []);

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Comando de Voz não suportado", description: "Use Chrome ou Edge para suporte a reconhecimento de voz.", variant: "destructive" });
      return;
    }
    if (voiceState === "listening") {
      recognitionRef.current?.stop();
      setVoiceState("idle");
      return;
    }
    if (voiceState === "speaking") {
      ttsRef.current?.stop();
      setVoiceState("idle");
      return;
    }
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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
      if (!resp.ok || !resp.body) throw new Error("Falha ao conectar com JARVIS");

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
          } catch { /* partial */ }
        }
      }

      // TTS — speak the response immediately after stream ends
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

  const currentMode = modes.find(m => m.value === mode)!;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in neural-bg neural-grid rounded-2xl overflow-hidden border neural-border">
        {/* === JARVIS HEADER === */}
        <div className="jarvis-card border-b border-white/5 p-4 flex items-center gap-4 shrink-0">
          {/* Logo orb */}
          <div className="relative shrink-0">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                voiceState === "idle" ? "voice-orb-idle" :
                voiceState === "listening" ? "voice-orb-listening" :
                voiceState === "speaking" ? "voice-orb-speaking" :
                "voice-orb-idle animate-neural-pulse"
              }`}
            >
              <Brain className="w-6 h-6 text-[hsl(186,100%,65%)]" />
            </div>
            <div className={`absolute inset-0 rounded-full border-2 animate-pulse-ring ${
              voiceState === "listening" ? "border-red-400/40" :
              voiceState === "speaking" ? "border-yellow-400/40" :
              "border-[hsl(200,100%,50%,0.25)]"
            }`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold neural-glow-text font-rajdhani tracking-widest uppercase">JARVIS</h1>
              <span className="text-xs gold-glow-text font-rajdhani">— IA Jurídica</span>
              <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400 bg-green-500/10 px-1.5 py-0">
                {voiceState === "idle" ? "Online" :
                 voiceState === "listening" ? "🔴 Ouvindo..." :
                 voiceState === "speaking" ? "🔊 Falando..." :
                 "⚙️ Processando..."}
              </Badge>
            </div>
            <p className="text-xs text-white/40 font-rajdhani">
              Modo: <span className="text-white/60">{currentMode.label}</span>
              {transcript && <span className="text-red-400 ml-2">"{transcript}"</span>}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mode selector */}
            <button
              onClick={() => setShowModePanel(!showModePanel)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white/80 hover:bg-white/10 transition-all text-xs"
            >
              <currentMode.icon className="w-3.5 h-3.5" />
              {currentMode.label}
              <ChevronDown className={`w-3 h-3 transition-transform ${showModePanel ? "rotate-180" : ""}`} />
            </button>

            {/* TTS toggle */}
            <button
              onClick={() => { setTtsEnabled(v => !v); ttsRef.current?.stop(); }}
              className={`p-2 rounded-lg border transition-all ${ttsEnabled ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" : "border-white/10 bg-white/5 text-white/30"}`}
              title={ttsEnabled ? "Desligar voz" : "Ligar voz"}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(v => !v)}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Panel Dropdown */}
        {showModePanel && (
          <div className="jarvis-card border-b border-white/5 p-3 grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => { setMode(m.value); setShowModePanel(false); }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${
                  mode === m.value
                    ? "border-[hsl(200,100%,50%,0.5)] bg-[hsl(200,100%,50%,0.12)] text-white"
                    : "border-white/10 bg-white/3 text-white/50 hover:bg-white/8 hover:text-white/70"
                }`}
              >
                <m.icon className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold leading-tight">{m.label}</p>
                  <p className="text-[10px] opacity-60">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="jarvis-card border-b border-white/5 p-4 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Configurações de Voz (TTS)
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-white/30 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wider">Provedor TTS</label>
                <select
                  value={ttsProvider}
                  onChange={e => setTtsProvider(e.target.value as TtsProvider)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-[hsl(200,100%,50%,0.4)]"
                >
                  {ttsProviders.map(p => (
                    <option key={p.value} value={p.value} className="bg-gray-900">{p.label}</option>
                  ))}
                </select>
              </div>
              {ttsProvider !== "browser" && (
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wider">API Key</label>
                  <input
                    type="password"
                    value={ttsApiKey}
                    onChange={e => setTtsApiKey(e.target.value)}
                    placeholder={`Chave de API ${ttsProvider}`}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-[hsl(200,100%,50%,0.4)]"
                  />
                </div>
              )}
              {ttsProvider === "openai" && (
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wider">Voz OpenAI</label>
                  <select
                    value={ttsVoice}
                    onChange={e => setTtsVoice(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-[hsl(200,100%,50%,0.4)]"
                  >
                    {openaiVoices.map(v => <option key={v} value={v} className="bg-gray-900">{v}</option>)}
                  </select>
                </div>
              )}
            </div>
            <p className="text-[11px] text-white/25 mt-3">
              O Navegador (Nativo) funciona offline e sem custo. Os provedores premium oferecem qualidade superior.
            </p>
          </div>
        )}

        {/* === MESSAGES AREA === */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
              {/* Central orb animation */}
              <div className="relative">
                <div className="w-28 h-28 rounded-full voice-orb-idle flex items-center justify-center animate-neural-pulse">
                  <Scale className="w-12 h-12 text-[hsl(186,100%,60%)]" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-[hsl(200,100%,50%,0.2)] animate-pulse-ring scale-125" />
                <div className="absolute inset-0 rounded-full border border-[hsl(200,100%,50%,0.1)] animate-pulse-ring scale-150" style={{ animationDelay: "0.5s" }} />
              </div>

              <div className="text-center max-w-sm">
                <h2 className="text-2xl font-bold gold-glow-text font-rajdhani tracking-wide mb-2">JARVIS ATIVO</h2>
                <p className="text-white/50 text-sm">
                  Assistente jurídico de inteligência artificial.<br />
                  Fale ou digite para começar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  "Analise este contrato de prestação de serviços",
                  "Quais os prazos para recurso em processo penal?",
                  "Gere uma petição inicial de indenização por danos morais",
                  "Resumo da lei 13.105 (CPC)",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="jarvis-card text-left p-3 rounded-xl text-xs text-white/50 hover:text-white/80 transition-all hover:border-[hsl(200,100%,50%,0.4)] flex items-center gap-2"
                  >
                    <ChevronRight className="w-3 h-3 text-[hsl(186,100%,55%)] shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 w-8 h-8 rounded-full voice-orb-idle flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[hsl(186,100%,60%)]" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "jarvis-message-user text-yellow-100 rounded-tr-sm"
                    : "jarvis-message-ai text-blue-100 rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <span className="text-yellow-400 text-xs font-bold">EU</span>
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 w-8 h-8 rounded-full voice-orb-idle flex items-center justify-center animate-neural-pulse">
                <Bot className="w-4 h-4 text-[hsl(186,100%,60%)]" />
              </div>
              <div className="jarvis-message-ai rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 rounded-full bg-blue-400 inline-block animate-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* === INPUT AREA === */}
        <div className="jarvis-card border-t border-white/5 p-4 shrink-0">
          <div className="flex gap-3 items-end">
            {/* Voice Button */}
            <button
              onClick={toggleVoice}
              className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                voiceState === "listening"
                  ? "voice-orb-listening"
                  : voiceState === "speaking"
                  ? "voice-orb-speaking"
                  : "voice-orb-idle hover:scale-105"
              }`}
              title={voiceState === "listening" ? "Parar gravação" : voiceState === "speaking" ? "Parar fala" : "Comando de voz"}
            >
              {voiceState === "listening"
                ? <MicOff className="w-5 h-5 text-red-400" />
                : voiceState === "speaking"
                ? <VolumeX className="w-5 h-5 text-yellow-400" />
                : <Mic className="w-5 h-5 text-[hsl(186,100%,65%)]" />
              }
            </button>

            {/* Text input */}
            <div className="flex-1">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  voiceState === "listening" ? "🔴 Ouvindo... fale agora" :
                  voiceState === "speaking" ? "🔊 JARVIS está respondendo..." :
                  "Digite ou fale sua pergunta jurídica..."
                }
                className="min-h-[48px] max-h-[120px] resize-none bg-white/5 border-white/15 text-white/80 placeholder-white/25 focus:border-[hsl(200,100%,50%,0.5)] focus:ring-0 rounded-xl transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
              />
            </div>

            {/* Send Button */}
            <Button
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-12 w-12 p-0 rounded-xl bg-gradient-to-br from-[hsl(200,100%,45%)] to-[hsl(200,100%,35%)] hover:from-[hsl(200,100%,50%)] hover:to-[hsl(200,100%,40%)] border-0 shadow-lg shadow-[hsl(200,100%,40%,0.3)] disabled:opacity-30 transition-all"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[10px] text-white/25">
              <Zap className="w-2.5 h-2.5 inline mr-0.5 text-yellow-400" />
              Gemini · Enter para enviar · Shift+Enter para nova linha
            </p>
            <div className="flex items-center gap-3 text-[10px] text-white/25">
              <span>TTS: {ttsProviders.find(p => p.value === ttsProvider)?.label}</span>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); ttsRef.current?.stop(); setVoiceState("idle"); }} className="text-white/25 hover:text-white/50 transition-colors">
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default IAJuridica;
