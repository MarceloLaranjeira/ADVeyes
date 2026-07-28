import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  Scale, Zap, Calendar, Bell, DollarSign, FileText, Bot,
  CheckCircle, ArrowRight, Star, Shield, Globe, ChevronDown,
  BarChart3, Users, Clock, Search, Menu, X, Gavel, ListTodo,
  TrendingUp, Award, Lock, Phone,
} from "lucide-react";
import { LogoMark } from "@/components/common/Logo";

// ─── Nav ──────────────────────────────────────────────────────────────────────
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <span className="font-serif font-bold text-[#1a2a5e] tracking-widest text-lg uppercase">ADVeyes</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {["Recursos", "Preços", "Sobre", "Contato"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-gray-600 hover:text-[#1a2a5e] transition-colors">
                {item}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate("/login")} className="text-sm font-medium text-gray-700 hover:text-[#1a2a5e] transition-colors px-4 py-2">
              Entrar
            </button>
            <button
              onClick={() => navigate("/login")}
              className="bg-[#1a2a5e] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#243570] transition-all hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
            >
              Teste Grátis <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4 space-y-1">
            {["Recursos", "Preços", "Sobre", "Contato"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                {item}
              </a>
            ))}
            <div className="border-t border-gray-100 pt-3 mt-3 px-4 space-y-2">
              <button onClick={() => navigate("/login")} className="w-full text-sm font-medium py-2.5 border border-gray-200 rounded-xl">Entrar</button>
              <button onClick={() => navigate("/login")} className="w-full bg-[#1a2a5e] text-white text-sm font-semibold py-2.5 rounded-xl">Começar grátis</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-[#0f1f4e] via-[#1a2a5e] to-[#243570] pt-16">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-10 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-0 w-80 h-80 bg-blue-400/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-yellow-400/3 rounded-full blur-2xl" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-1.5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-yellow-300 text-xs font-semibold tracking-wide">7 dias grátis · Sem cartão · Sem pegadinha</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight mb-6">
              Gestão Jurídica para Advogados que{" "}
              <span className="text-yellow-400">não perdem</span>{" "}
              tempo
            </h1>

            <p className="text-lg text-blue-200/80 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Controle processos, agenda, honorários e use IA jurídica avançada — tudo em um só lugar.
              Andamentos automáticos de 85+ tribunais, Diário Oficial e muito mais.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button
                onClick={() => navigate("/login")}
                className="bg-yellow-500 hover:bg-yellow-400 text-[#1a2a5e] font-bold px-8 py-4 rounded-xl text-base transition-all hover:shadow-2xl hover:shadow-yellow-500/25 hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
              >
                Começar grátis agora
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="border border-white/20 text-white font-semibold px-8 py-4 rounded-xl text-base hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                <Scale className="w-4 h-4" />
                Ver demonstração
              </button>
            </div>

            {/* Trust */}
            <div className="mt-10 flex items-center gap-6 justify-center lg:justify-start flex-wrap">
              {[
                { icon: Shield, text: "Dados criptografados" },
                { icon: Globe, text: "85+ tribunais" },
                { icon: Bot, text: "IA jurídica inclusa" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-blue-200/60 text-xs">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — App mockup */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl">
                {/* Dashboard preview */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <div className="flex-1 bg-white/5 rounded-md h-5 ml-2" />
                </div>

                {/* Fake metric cards */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "Processos", value: "247", color: "text-blue-400" },
                    { label: "Audiências", value: "12", color: "text-purple-400" },
                    { label: "Prazos", value: "3", color: "text-red-400" },
                  ].map(m => (
                    <div key={m.label} className="bg-white/5 border border-white/8 rounded-xl p-3">
                      <p className="text-white/40 text-[9px] uppercase tracking-wider">{m.label}</p>
                      <p className={`text-2xl font-bold font-serif ${m.color} mt-1`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div className="bg-white/5 border border-white/8 rounded-xl p-3 mb-3">
                  <p className="text-white/50 text-[9px] uppercase tracking-wider mb-3">Andamentos Processuais</p>
                  {[
                    { tipo: "Sentença", desc: "Processo 0124123-91 — Julgado procedente", cor: "bg-green-500" },
                    { tipo: "Audiência", desc: "Audiência de instrução marcada para 25/03", cor: "bg-purple-500" },
                    { tipo: "Despacho", desc: "Intimação para apresentar documentos", cor: "bg-blue-500" },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-2.5 mb-2.5 last:mb-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.cor} mt-1.5 shrink-0`} />
                      <div>
                        <p className="text-[10px] font-semibold text-white/70">{item.tipo}</p>
                        <p className="text-[9px] text-white/40">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI preview */}
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
                    <Bot className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-blue-300">JARVIS IA</p>
                    <p className="text-[9px] text-white/40">Analisando jurisprudência...</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1 h-3 bg-blue-400/50 rounded-full" style={{ animation: `pulse-speak 0.7s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                85+ tribunais ✓
              </div>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          <p className="text-white/40 text-xs uppercase tracking-wider">Confiado por advogados em todo Brasil</p>
          {["OAB/AM", "OAB/SP", "OAB/RJ", "OAB/BA", "OAB/MG"].map(oab => (
            <span key={oab} className="text-white/25 text-sm font-semibold tracking-wider">{oab}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Features ────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Scale,
    color: "bg-blue-50 text-blue-600",
    title: "Controle de Processos",
    desc: "Gerencie todos os processos com timeline de andamentos, partes, custas e honorários em um único lugar.",
  },
  {
    icon: Zap,
    color: "bg-yellow-50 text-yellow-600",
    title: "Andamentos Automáticos",
    desc: "Captura automática via DataJud de 85+ tribunais, SEEU e Projudi. Processos sempre atualizados.",
  },
  {
    icon: Calendar,
    color: "bg-green-50 text-green-600",
    title: "Agenda Inteligente",
    desc: "Conecte sua própria conta Google uma vez e sincronize automaticamente os eventos que você criar no ADVeyes.",
  },
  {
    icon: Bot,
    color: "bg-purple-50 text-purple-600",
    title: "IA Jurídica JARVIS",
    desc: "Assistente com voz que redige peças, analisa documentos, pesquisa jurisprudência e responde dúvidas jurídicas.",
  },
  {
    icon: Bell,
    color: "bg-orange-50 text-orange-600",
    title: "Publicações DJE",
    desc: "Monitore diários oficiais e receba recortes automáticos por nome, OAB ou palavras-chave.",
  },
  {
    icon: DollarSign,
    color: "bg-emerald-50 text-emerald-600",
    title: "Financeiro Completo",
    desc: "Controle honorários, parcelas, custas e cobranças. Relatórios detalhados e integração com Asaas.",
  },
];

const Features = () => (
  <section id="recursos" className="py-24 bg-gray-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <span className="inline-block text-xs font-bold tracking-widest text-yellow-600 uppercase bg-yellow-50 px-4 py-1.5 rounded-full border border-yellow-100 mb-4">
          Recursos
        </span>
        <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1a2a5e] mb-4">
          Tudo que você precisa para<br />gerir seu escritório
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto">
          Um sistema completo desenvolvido por advogados, para advogados. Sem complexidade desnecessária.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f) => (
          <div
            key={f.title}
            className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group cursor-default"
          >
            <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <f.icon className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-[#1a2a5e] text-lg mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── How It Works ─────────────────────────────────────────────────────────────
const steps = [
  { n: "01", title: "Cadastre-se em 2 minutos", desc: "Crie sua conta gratuitamente. Sem cartão de crédito. Sem formulário complicado." },
  { n: "02", title: "Importe seus processos", desc: "Adicione processos manualmente ou deixe o ADVeyes buscar automaticamente nos tribunais pelo seu número OAB." },
  { n: "03", title: "Deixe o ADVeyes trabalhar", desc: "Andamentos automáticos, alertas de prazo, publicações e IA jurídica sempre ao seu lado." },
];

const HowItWorks = () => (
  <section className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <span className="inline-block text-xs font-bold tracking-widest text-blue-600 uppercase bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 mb-4">Como funciona</span>
        <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1a2a5e] mb-4">Simples assim</h2>
        <p className="text-gray-500">3 passos para transformar sua gestão jurídica</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((s, i) => (
          <div key={s.n} className="relative text-center">
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-8 left-2/3 w-1/3 h-px bg-gradient-to-r from-gray-200 to-gray-100" />
            )}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1a2a5e] text-yellow-400 font-serif font-bold text-2xl mb-5 shadow-lg">
              {s.n}
            </div>
            <h3 className="font-serif font-bold text-[#1a2a5e] text-xl mb-3">{s.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Pricing ─────────────────────────────────────────────────────────────────
const plans = [
  {
    name: "Starter",
    price: 97,
    yearly: 77,
    color: "border-gray-200",
    popular: false,
    features: ["1 advogado", "50 processos", "Agenda e Tarefas", "IA básica (50 consultas/mês)", "Suporte por e-mail", "Andamentos manuais"],
  },
  {
    name: "Profissional",
    price: 197,
    yearly: 157,
    color: "border-[#1a2a5e]",
    popular: true,
    features: ["3 advogados", "Processos ilimitados", "Todas as ferramentas", "IA avançada ilimitada", "Diário Oficial automático", "Andamentos automáticos DataJud", "Google Calendar sync", "Suporte prioritário"],
  },
  {
    name: "Escritório",
    price: 397,
    yearly: 317,
    color: "border-gray-200",
    popular: false,
    features: ["Advogados ilimitados", "Tudo do Profissional", "API personalizada", "Webhooks", "Relatórios customizados", "Gerente de conta dedicado", "Onboarding personalizado", "White-label opcional"],
  },
];

const Pricing = () => {
  const [yearly, setYearly] = useState(false);
  const navigate = useNavigate();

  return (
    <section id="preços" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-bold tracking-widest text-green-700 uppercase bg-green-50 px-4 py-1.5 rounded-full border border-green-100 mb-4">Preços</span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1a2a5e] mb-4">Simples e transparente</h2>
          <p className="text-gray-500 mb-8">7 dias grátis, cancele quando quiser, sem burocracia</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1">
            <button onClick={() => setYearly(false)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${!yearly ? "bg-[#1a2a5e] text-white" : "text-gray-500"}`}>Mensal</button>
            <button onClick={() => setYearly(true)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${yearly ? "bg-[#1a2a5e] text-white" : "text-gray-500"}`}>
              Anual <span className="text-green-500 text-xs ml-1">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div key={p.name} className={`relative bg-white rounded-2xl border-2 ${p.color} p-6 ${p.popular ? "shadow-xl scale-105 z-10" : "shadow-sm"} transition-all hover:shadow-lg`}>
              {p.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-[#1a2a5e] text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                  MAIS POPULAR
                </div>
              )}
              <h3 className="font-serif font-bold text-[#1a2a5e] text-xl mb-1">{p.name}</h3>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold text-[#1a2a5e]">R$ {yearly ? p.yearly : p.price}</span>
                <span className="text-gray-400 text-sm mb-1">/mês</span>
              </div>
              {yearly && <p className="text-xs text-green-600 font-medium mb-4">Cobrado anualmente</p>}
              {!yearly && <p className="text-xs text-gray-400 mb-4">&nbsp;</p>}

              <ul className="space-y-2.5 mb-6">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate("/login")}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 ${p.popular
                  ? "bg-[#1a2a5e] text-white hover:bg-[#243570] hover:shadow-lg"
                  : "border-2 border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
                }`}
              >
                Começar 7 dias grátis
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8 flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5" />
          Sem cartão de crédito necessário · Cancele a qualquer momento · Dados 100% seguros (LGPD)
        </p>
      </div>
    </section>
  );
};

// ─── Testimonials ─────────────────────────────────────────────────────────────
const testimonials = [
  {
    name: "Dr. Rodrigo Figueiredo",
    role: "Advogado Criminalista · OAB/AM 12.305",
    text: "O ADVeyes mudou completamente minha rotina. Os andamentos automáticos do TJAM me economizam pelo menos 2 horas por dia. A IA jurídica é impressionante para redigir recursos.",
    stars: 5,
  },
  {
    name: "Dra. Camila Resende",
    role: "Sócia · Resende & Associados · OAB/SP 45.210",
    text: "Gerencio 3 advogados e 400 processos com facilidade. O Dashboard me dá visibilidade total do escritório. O suporte é excelente e responsivo.",
    stars: 5,
  },
  {
    name: "Dr. André Santana",
    role: "Advogado Trabalhista · OAB/BA 28.907",
    text: "A integração com o DataJud é perfeita. Todos os andamentos chegam automáticos. Nunca mais perdi um prazo desde que comecei a usar o ADVeyes.",
    stars: 5,
  },
];

const Testimonials = () => (
  <section className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <span className="inline-block text-xs font-bold tracking-widest text-yellow-600 uppercase bg-yellow-50 px-4 py-1.5 rounded-full border border-yellow-100 mb-4">Depoimentos</span>
        <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1a2a5e] mb-4">O que os advogados dizem</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map(t => (
          <div key={t.name} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-all">
            <div className="flex gap-0.5 mb-4">
              {Array.from({ length: t.stars }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
            <div>
              <p className="font-semibold text-[#1a2a5e] text-sm">{t.name}</p>
              <p className="text-gray-400 text-xs mt-0.5">{t.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── CTA Banner ───────────────────────────────────────────────────────────────
const CTABanner = () => {
  const navigate = useNavigate();
  return (
    <section className="py-24 bg-gradient-to-br from-[#0f1f4e] via-[#1a2a5e] to-[#243570] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-400/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <LogoMark dark size="lg" className="mx-auto mb-6" />
        <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
          Pronto para transformar<br />seu escritório?
        </h2>
        <p className="text-blue-200/70 text-lg mb-8">
          Junte-se a centenas de advogados que já usam o ADVeyes para trabalhar melhor.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate("/login")}
            className="bg-yellow-500 hover:bg-yellow-400 text-[#1a2a5e] font-bold px-10 py-4 rounded-xl text-base transition-all hover:shadow-2xl hover:shadow-yellow-500/25 hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
          >
            Começar 7 dias grátis
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <p className="text-white/30 text-xs mt-6 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" /> Sem cartão · Sem compromisso · Cancele quando quiser
        </p>
      </div>
    </section>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer className="bg-[#0a1535] text-white/50 py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <LogoMark dark size="sm" />
          <div>
            <div className="font-serif font-bold tracking-widest text-sm uppercase text-white/80">ADVeyes</div>
            <div className="text-[9px] tracking-widest uppercase text-white/30">Gestão Jurídica</div>
          </div>
        </div>
        <div className="flex gap-6 text-xs">
          <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
          <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade (LGPD)</Link>
          <a href="mailto:marcelolaranjeira33@gmail.com" className="hover:text-white transition-colors">Contato</a>
          <a href="mailto:marcelolaranjeira33@gmail.com" className="hover:text-white transition-colors">Suporte</a>
        </div>
        <p className="text-xs">© 2026 ADVeyes · Operado pela Automatikus</p>
      </div>
    </div>
  </footer>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const Landing = () => (
  <div className="min-h-screen">
    <Nav />
    <Hero />
    <Features />
    <HowItWorks />
    <Pricing />
    <Testimonials />
    <CTABanner />
    <Footer />
  </div>
);

export default Landing;
