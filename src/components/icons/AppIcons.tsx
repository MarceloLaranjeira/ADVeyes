/**
 * ADVeyes — Ícones contextuais customizados
 * SVG illustrations que contam a história de cada seção
 */

interface IconProps {
  className?: string;
  size?: number;
}

/* ─────────────────────────────────────────────
   NAVEGAÇÃO PRINCIPAL
───────────────────────────────────────────── */

/** Dashboard — olho vigilante monitorando dados jurídicos */
export const IconDashboard = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 16C3 16 8.5 7 16 7C23.5 7 29 16 29 16C29 16 23.5 25 16 25C8.5 25 3 16 3 16Z" fill="#dbeafe" fillOpacity="0.6" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="16" cy="16" r="5" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.6"/>
    <circle cx="16" cy="16" r="2.2" fill="#1d4ed8"/>
    <circle cx="17.2" cy="14.8" r="0.9" fill="white"/>
    <rect x="5" y="21" width="2.5" height="3" rx="0.6" fill="#3b82f6" opacity="0.5"/>
    <rect x="9" y="19" width="2.5" height="5" rx="0.6" fill="#3b82f6" opacity="0.6"/>
    <rect x="13" y="17" width="2.5" height="7" rx="0.6" fill="#2563eb" opacity="0.7"/>
    <rect x="17" y="15" width="2.5" height="9" rx="0.6" fill="#2563eb" opacity="0.6"/>
    <rect x="21" y="18" width="2.5" height="6" rx="0.6" fill="#3b82f6" opacity="0.5"/>
  </svg>
);

/** Processos — balança da justiça com processo CNJ */
export const IconProcessos = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <line x1="16" y1="5" x2="16" y2="27" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="8" y1="8" x2="24" y2="8" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 8L5 14H11L8 8Z" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M24 8L21 14H27L24 8Z" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.4" strokeLinejoin="round"/>
    <rect x="5" y="14" width="6" height="1.5" rx="0.75" fill="#93c5fd"/>
    <rect x="21" y="14" width="6" height="1.5" rx="0.75" fill="#93c5fd"/>
    <rect x="11" y="26" width="10" height="1.5" rx="0.75" fill="#1d4ed8" opacity="0.5"/>
    <rect x="13" y="20" width="6" height="1" rx="0.5" fill="#3b82f6" opacity="0.5"/>
    <rect x="14" y="22.5" width="4" height="0.8" rx="0.4" fill="#3b82f6" opacity="0.4"/>
  </svg>
);

/** Clientes — pessoa de terno com pasta */
export const IconClientes = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="16" cy="9" r="4.5" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.6"/>
    <path d="M6 26C6 20.477 10.477 16 16 16C21.523 16 26 20.477 26 26" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round"/>
    <rect x="12" y="19" width="8" height="5.5" rx="1" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.2"/>
    <path d="M14 19V18C14 17 14.9 16.5 16 16.5C17.1 16.5 18 17 18 18V19" stroke="#2563eb" strokeWidth="1.2"/>
    <line x1="14" y1="21" x2="18" y2="21" stroke="#2563eb" strokeWidth="0.9" strokeLinecap="round"/>
  </svg>
);

/** CRM / Leads — funil com estrela de conversão */
export const IconLeads = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M5 7H27L20 15V24L16 26.5L12 24V15L5 7Z" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round"/>
    <circle cx="16" cy="22" r="3" fill="#2563eb" fillOpacity="0.15" stroke="#2563eb" strokeWidth="1.2"/>
    <path d="M16 20.2L16.6 21.5H18L17 22.4L17.4 23.8L16 23L14.6 23.8L15 22.4L14 21.5H15.4L16 20.2Z" fill="#2563eb"/>
    <circle cx="9" cy="6" r="1.5" fill="#93c5fd"/>
    <circle cx="23" cy="6" r="1.5" fill="#93c5fd"/>
  </svg>
);

/** Equipe — três silhuetas de advogados */
export const IconEquipe = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="16" cy="9" r="3.5" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M8 26C8 21.582 11.582 18 16 18C20.418 18 24 21.582 24 26" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7" cy="11" r="2.8" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.2"/>
    <path d="M1 26C1 22.686 3.686 20 7 20" stroke="#93c5fd" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="25" cy="11" r="2.8" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.2"/>
    <path d="M31 26C31 22.686 28.314 20 25 20" stroke="#93c5fd" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

/** Agenda — calendário com martelo */
export const IconAgenda = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="7" width="24" height="20" rx="3" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.6"/>
    <path d="M4 12H28" stroke="#2563eb" strokeWidth="1.4"/>
    <circle cx="10" cy="5" r="1.5" fill="#2563eb"/>
    <circle cx="22" cy="5" r="1.5" fill="#2563eb"/>
    <line x1="10" y1="4" x2="10" y2="8" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
    <line x1="22" y1="4" x2="22" y2="8" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
    <rect x="8" y="15" width="3.5" height="3.5" rx="0.8" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1"/>
    <rect x="14" y="15" width="3.5" height="3.5" rx="0.8" fill="#2563eb" fillOpacity="0.8"/>
    <rect x="20" y="15" width="3.5" height="3.5" rx="0.8" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1"/>
    <rect x="8" y="21" width="3.5" height="3.5" rx="0.8" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1"/>
    <rect x="14" y="21" width="3.5" height="3.5" rx="0.8" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1"/>
  </svg>
);

/** Tarefas — prancheta com checklist e caneta */
export const IconTarefas = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="6" y="4" width="20" height="24" rx="2.5" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.6"/>
    <rect x="11" y="2" width="10" height="4" rx="2" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.4"/>
    <circle cx="10" cy="12" r="1.5" fill="#2563eb"/>
    <line x1="13" y1="12" x2="22" y2="12" stroke="#2563eb" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="10" cy="17" r="1.5" fill="#2563eb" fillOpacity="0.5"/>
    <line x1="13" y1="17" x2="22" y2="17" stroke="#2563eb" strokeWidth="1.4" strokeLinecap="round" opacity="0.6"/>
    <circle cx="10" cy="22" r="1.5" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1"/>
    <line x1="13" y1="22" x2="19" y2="22" stroke="#93c5fd" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"/>
    <path d="M9.5 11.5L10.5 12.5L12 11" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Audiências — martelo sobre bloco */
export const IconAudiencias = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="6" y="26" width="20" height="3" rx="1.5" fill="#1d4ed8" opacity="0.4"/>
    <rect x="10" y="23" width="12" height="3" rx="1.5" fill="#1d4ed8" opacity="0.6"/>
    <rect x="18" y="8" width="5" height="13" rx="2" transform="rotate(-35 18 8)" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.5"/>
    <rect x="6" y="5" width="12" height="7" rx="2.5" transform="rotate(-35 6 5)" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.5"/>
    <line x1="17" y1="19" x2="22" y2="24" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/** Publicações — jornal/diário de justiça com sino */
export const IconPublicacoes = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="8" width="18" height="21" rx="2" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.5"/>
    <rect x="7" y="8" width="18" height="21" rx="2" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.5"/>
    <line x1="10" y1="14" x2="22" y2="14" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
    <line x1="10" y1="18" x2="22" y2="18" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    <line x1="10" y1="21" x2="19" y2="21" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    <line x1="10" y1="24" x2="16" y2="24" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    <rect x="10" y="10" width="12" height="2.5" rx="0.5" fill="#bfdbfe"/>
    <circle cx="23" cy="9" r="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
    <path d="M21 8.5C21 7.7 21.7 7 22.5 7H23.5C24.3 7 25 7.7 25 8.5V9.5C25 10.3 24.3 11 23.5 11H22.5C21.7 11 21 10.3 21 9.5V8.5Z" fill="#f59e0b" fillOpacity="0.3"/>
    <line x1="23" y1="11" x2="23" y2="12" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M21.5 12H24.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

/** Busca Processual — lupa sobre processo */
export const IconBusca = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="5" width="17" height="22" rx="2" fill="#dbeafe" fillOpacity="0.5" stroke="#93c5fd" strokeWidth="1.4"/>
    <line x1="7" y1="10" x2="18" y2="10" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <line x1="7" y1="13" x2="18" y2="13" stroke="#2563eb" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    <line x1="7" y1="16" x2="14" y2="16" stroke="#2563eb" strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
    <circle cx="22" cy="22" r="7" fill="#eff6ff" stroke="#2563eb" strokeWidth="2"/>
    <circle cx="22" cy="22" r="4" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.5"/>
    <line x1="27" y1="27" x2="30" y2="30" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="20" y1="22" x2="24" y2="22" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="22" y1="20" x2="22" y2="24" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

/** Jurisprudência — livro aberto com balança */
export const IconJurisprudencia = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 8C4 7.447 4.447 7 5 7H15C15.553 7 16 7.447 16 8V25H4V8Z" fill="#dbeafe" fillOpacity="0.6" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M28 8C28 7.447 27.553 7 27 7H17C16.447 7 16 7.447 16 8V25H28V8Z" fill="#bfdbfe" fillOpacity="0.6" stroke="#2563eb" strokeWidth="1.5"/>
    <line x1="4" y1="25" x2="28" y2="25" stroke="#2563eb" strokeWidth="1.5"/>
    <line x1="16" y1="7" x2="16" y2="27" stroke="#1d4ed8" strokeWidth="1.8"/>
    <line x1="12" y1="12" x2="20" y2="12" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M12 12L10 16H14L12 12Z" fill="#93c5fd" stroke="#2563eb" strokeWidth="1" strokeLinejoin="round"/>
    <path d="M20 12L18 16H22L20 12Z" fill="#93c5fd" stroke="#2563eb" strokeWidth="1" strokeLinejoin="round"/>
    <rect x="10" y="16" width="4" height="0.8" rx="0.4" fill="#2563eb" opacity="0.5"/>
    <rect x="18" y="16" width="4" height="0.8" rx="0.4" fill="#2563eb" opacity="0.5"/>
    <line x1="7" y1="19" x2="13" y2="19" stroke="#2563eb" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
    <line x1="7" y1="21.5" x2="13" y2="21.5" stroke="#2563eb" strokeWidth="0.9" strokeLinecap="round" opacity="0.4"/>
    <line x1="19" y1="19" x2="25" y2="19" stroke="#2563eb" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
    <line x1="19" y1="21.5" x2="25" y2="21.5" stroke="#2563eb" strokeWidth="0.9" strokeLinecap="round" opacity="0.4"/>
  </svg>
);

/** Financeiro — moedas empilhadas com seta crescente */
export const IconFinanceiro = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <ellipse cx="13" cy="24" rx="9" ry="3" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.5"/>
    <ellipse cx="13" cy="20" rx="9" ry="3" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M4 24V20" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M22 24V20" stroke="#2563eb" strokeWidth="1.5"/>
    <ellipse cx="13" cy="16" rx="9" ry="3" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M4 20V16" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M22 20V16" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M20 12L23 9L26 6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 6H26V10" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 14C14 14 14.5 13 16 13C17.5 13 18 13.5 18 14.5C18 15.5 17 16 16 16.5C15 17 14 17.5 14 18.5C14 19.5 14.8 20 16 20C17.2 20 18 19 18 19" stroke="#2563eb" strokeWidth="1.1" strokeLinecap="round"/>
    <line x1="16" y1="12.5" x2="16" y2="14" stroke="#2563eb" strokeWidth="1.1" strokeLinecap="round"/>
    <line x1="16" y1="19" x2="16" y2="20.5" stroke="#2563eb" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

/** Controle de Horas — ampulheta com areia e relógio */
export const IconHoras = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M9 4H23" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
    <path d="M9 28H23" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
    <path d="M10 4L10 11C10 11 13 14.5 16 16C19 17.5 22 21 22 21V28" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 4L22 11C22 11 19 14.5 16 16C13 17.5 10 21 10 21V28" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 6C11 6 13 8 16 9C19 10 21 12 21 12" fill="#bfdbfe" fillOpacity="0.4" stroke="none"/>
    <ellipse cx="16" cy="22" rx="4.5" ry="3" fill="#bfdbfe" fillOpacity="0.7"/>
    <circle cx="24" cy="10" r="5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="24" y1="7.5" x2="24" y2="10.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="24" y1="10.5" x2="25.5" y2="11.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

/** Contratos & Templates — rolo com assinatura e selo */
export const IconContratos = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M8 5C8 5 6 5 6 7V27C6 27 6 29 8 29H24C24 29 26 29 26 27V7C26 7 26 5 24 5H8Z" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M6 7C6 7 7 9 9 9C11 9 12 7 12 7" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="10" y1="13" x2="22" y2="13" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
    <line x1="10" y1="16" x2="22" y2="16" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <line x1="10" y1="19" x2="18" y2="19" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    <path d="M10 23C10.5 22 11.5 22.5 12 23C12.5 23.5 13.5 24 14 23C14.5 22 15.5 23 16 23" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="24" cy="24" r="4" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1.5"/>
    <path d="M22.5 24L23.5 25L25.5 23" stroke="#ca8a04" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Documentos — pasta com papéis */
export const IconDocumentos = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="12" width="24" height="17" rx="2.5" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.6"/>
    <path d="M4 15H28" stroke="#2563eb" strokeWidth="1" opacity="0.4"/>
    <path d="M4 14C4 14 4 12 6 12H13L15 10H4C4 10 2 10 2 12V14" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.4"/>
    <rect x="8" y="18" width="7" height="8" rx="1.5" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.2"/>
    <line x1="9.5" y1="21" x2="13.5" y2="21" stroke="#2563eb" strokeWidth="0.9" strokeLinecap="round" opacity="0.6"/>
    <line x1="9.5" y1="23" x2="13.5" y2="23" stroke="#2563eb" strokeWidth="0.9" strokeLinecap="round" opacity="0.4"/>
    <rect x="17" y="18" width="7" height="8" rx="1.5" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1.2"/>
    <line x1="18.5" y1="21" x2="22.5" y2="21" stroke="#93c5fd" strokeWidth="0.9" strokeLinecap="round" opacity="0.6"/>
    <line x1="18.5" y1="23" x2="22.5" y2="23" stroke="#93c5fd" strokeWidth="0.9" strokeLinecap="round" opacity="0.4"/>
  </svg>
);

/** Relatórios — gráfico de barras com seta */
export const IconRelatorios = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <line x1="5" y1="27" x2="27" y2="27" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="5" y1="6" x2="5" y2="27" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
    <rect x="8" y="18" width="4" height="9" rx="1" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.2"/>
    <rect x="14" y="13" width="4" height="14" rx="1" fill="#93c5fd" stroke="#2563eb" strokeWidth="1.2"/>
    <rect x="20" y="8" width="4" height="19" rx="1" fill="#3b82f6" stroke="#2563eb" strokeWidth="1.2"/>
    <path d="M9 15L14 11L20 6L25 4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 2"/>
    <path d="M22 4L25 4L25 7" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** WhatsApp — smartphone com bolha de chat jurídico */
export const IconWhatsApp = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="9" y="3" width="14" height="26" rx="3" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.5"/>
    <line x1="9" y1="7" x2="23" y2="7" stroke="#2563eb" strokeWidth="1" opacity="0.4"/>
    <line x1="9" y1="25" x2="23" y2="25" stroke="#2563eb" strokeWidth="1" opacity="0.4"/>
    <circle cx="16" cy="27" r="1" fill="#2563eb" opacity="0.5"/>
    <path d="M11 14C11 12.895 11.895 12 13 12H22C23.105 12 24 12.895 24 14V19C24 20.105 23.105 21 22 21H17L14 23V21H13C11.895 21 11 20.105 11 19V14Z" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.4"/>
    <line x1="13" y1="15.5" x2="20" y2="15.5" stroke="#16a34a" strokeWidth="1" strokeLinecap="round"/>
    <line x1="13" y1="17.5" x2="18" y2="17.5" stroke="#16a34a" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

/** Portal do Cliente — pessoa com chave digital */
export const IconPortalCliente = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="4" width="24" height="24" rx="4" fill="#dbeafe" fillOpacity="0.3" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3 2"/>
    <circle cx="16" cy="12" r="4" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.5"/>
    <path d="M8 26C8 22.134 11.582 19 16 19C20.418 19 24 22.134 24 26" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="24" cy="10" r="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.4"/>
    <circle cx="24" cy="10" r="1.5" stroke="#f59e0b" strokeWidth="1.2"/>
    <line x1="26" y1="10" x2="28" y2="10" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="28" y1="10" x2="28" y2="12" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

/** Configurações — engrenagem com balança */
export const IconConfiguracoes = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M16 3L17.5 7H20.5L18 9.5L19 13L16 11L13 13L14 9.5L11.5 7H14.5L16 3Z" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1" strokeLinejoin="round"/>
    <circle cx="16" cy="16" r="8" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.5"/>
    <circle cx="16" cy="16" r="3" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.4"/>
    <line x1="16" y1="11" x2="16" y2="12.5" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="16" y1="19.5" x2="16" y2="21" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="11" y1="16" x2="12.5" y2="16" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="19.5" y1="16" x2="21" y2="16" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="12.3" y1="12.3" x2="13.4" y2="13.4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="18.6" y1="18.6" x2="19.7" y2="19.7" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="19.7" y1="12.3" x2="18.6" y2="13.4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="13.4" y1="18.6" x2="12.3" y2="19.7" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─────────────────────────────────────────────
   HORUS IA — Olho de Horus com rede neural
───────────────────────────────────────────── */
export const IconHorusIA = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Glow base */}
    <circle cx="16" cy="16" r="14" fill="#0f172a" fillOpacity="0.3"/>
    {/* Eye shape */}
    <path d="M2 16C2 16 7.5 6 16 6C24.5 6 30 16 30 16C30 16 24.5 26 16 26C7.5 26 2 16 2 16Z" fill="#0c1a35" stroke="#06b6d4" strokeWidth="1.5"/>
    {/* Iris */}
    <circle cx="16" cy="16" r="6" fill="#0f2d4a" stroke="#06b6d4" strokeWidth="1.5"/>
    {/* Pupil */}
    <circle cx="16" cy="16" r="3" fill="#06b6d4" fillOpacity="0.3"/>
    <circle cx="16" cy="16" r="1.5" fill="#06b6d4"/>
    {/* Gleam */}
    <circle cx="17.5" cy="14.5" r="1" fill="white" fillOpacity="0.8"/>
    {/* Neural network dots */}
    <circle cx="6" cy="12" r="1" fill="#06b6d4" fillOpacity="0.6"/>
    <circle cx="4" cy="19" r="0.8" fill="#06b6d4" fillOpacity="0.5"/>
    <circle cx="9" cy="8" r="0.8" fill="#06b6d4" fillOpacity="0.4"/>
    <circle cx="26" cy="12" r="1" fill="#06b6d4" fillOpacity="0.6"/>
    <circle cx="28" cy="19" r="0.8" fill="#06b6d4" fillOpacity="0.5"/>
    <circle cx="23" cy="8" r="0.8" fill="#06b6d4" fillOpacity="0.4"/>
    {/* Neural connections */}
    <line x1="6" y1="12" x2="10" y2="14" stroke="#06b6d4" strokeWidth="0.6" opacity="0.4"/>
    <line x1="4" y1="19" x2="10" y2="18" stroke="#06b6d4" strokeWidth="0.6" opacity="0.3"/>
    <line x1="9" y1="8" x2="10" y2="14" stroke="#06b6d4" strokeWidth="0.6" opacity="0.3"/>
    <line x1="26" y1="12" x2="22" y2="14" stroke="#06b6d4" strokeWidth="0.6" opacity="0.4"/>
    <line x1="28" y1="19" x2="22" y2="18" stroke="#06b6d4" strokeWidth="0.6" opacity="0.3"/>
    <line x1="23" y1="8" x2="22" y2="14" stroke="#06b6d4" strokeWidth="0.6" opacity="0.3"/>
    {/* Horus tail */}
    <path d="M20 22C22 24 24 25 27 24" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
    <path d="M12 22C10 24 8 25 5 24" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
  </svg>
);

/* ─────────────────────────────────────────────
   NOTIFICAÇÕES — tipos contextuais
───────────────────────────────────────────── */

/** Movimentação processual — balança em movimento */
export const IconMovimentacao = ({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <line x1="10" y1="2" x2="10" y2="18" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="4" y1="5" x2="16" y2="5" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M4 5L2 9H6L4 5Z" fill="#06b6d4" fillOpacity="0.3" stroke="#06b6d4" strokeWidth="1" strokeLinejoin="round"/>
    <path d="M16 5L14 9H18L16 5Z" fill="#06b6d4" fillOpacity="0.6" stroke="#06b6d4" strokeWidth="1" strokeLinejoin="round"/>
    <rect x="2" y="9" width="4" height="0.8" rx="0.4" fill="#06b6d4" opacity="0.5"/>
    <rect x="14" y="9" width="4" height="0.8" rx="0.4" fill="#06b6d4" opacity="0.5"/>
  </svg>
);

/** Alerta — triângulo com símbolo de prazo */
export const IconAlerta = ({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 2L18 17H2L10 2Z" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
    <line x1="10" y1="8" x2="10" y2="12" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="14.5" r="0.8" fill="#f59e0b"/>
  </svg>
);

/** Sistema — escudo com circuito */
export const IconSistema = ({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 2L17 5V10C17 14 10 18 10 18C10 18 3 14 3 10V5L10 2Z" fill="#dbeafe" fillOpacity="0.5" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M7 10L9 12L13 8" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Publicação notificação — gazeta com sino */
export const IconPublicacaoNotif = ({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="4" width="12" height="13" rx="1.5" fill="#f3e8ff" stroke="#a855f7" strokeWidth="1.3"/>
    <line x1="4" y1="8" x2="11" y2="8" stroke="#a855f7" strokeWidth="1" strokeLinecap="round"/>
    <line x1="4" y1="10.5" x2="11" y2="10.5" stroke="#a855f7" strokeWidth="0.8" strokeLinecap="round" opacity="0.7"/>
    <line x1="4" y1="13" x2="8" y2="13" stroke="#a855f7" strokeWidth="0.8" strokeLinecap="round" opacity="0.5"/>
    <rect x="4" y="5" width="7" height="1.5" rx="0.4" fill="#c084fc" fillOpacity="0.5"/>
    <path d="M14 4C14 4 13 5 13 6.5C13 8 13.5 9 14 9C14.5 9 15 8 15 6.5C15 5 14 4 14 4Z" fill="#fef9c3" stroke="#a16207" strokeWidth="1"/>
    <path d="M13 9H15" stroke="#a16207" strokeWidth="1" strokeLinecap="round"/>
    <line x1="14" y1="9" x2="14" y2="10.5" stroke="#a16207" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

/* ─────────────────────────────────────────────
   DASHBOARD MÉTRICAS
───────────────────────────────────────────── */

/** Processos ativos — scroll com status ativo */
export const IconMetricProcessos = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="6" y="4" width="20" height="24" rx="3" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.5"/>
    <line x1="10" y1="10" x2="22" y2="10" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="10" y1="14" x2="22" y2="14" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
    <line x1="10" y1="18" x2="18" y2="18" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <circle cx="23" cy="24" r="5" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/>
    <path d="M21 24L22.5 25.5L25 23" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Audiências hoje — martelo com relógio */
export const IconMetricAudiencias = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="24" width="16" height="3" rx="1.5" fill="#2563eb" opacity="0.4"/>
    <rect x="7" y="21" width="10" height="3" rx="1.5" fill="#2563eb" opacity="0.5"/>
    <rect x="14" y="9" width="4" height="11" rx="1.8" transform="rotate(-35 14 9)" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.4"/>
    <rect x="4" y="5" width="10" height="6.5" rx="2.5" transform="rotate(-35 4 5)" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.4"/>
    <circle cx="24" cy="10" r="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="24" y1="7" x2="24" y2="10.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="24" y1="10.5" x2="26" y2="11.5" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

/** Receita mensal — saco de dinheiro com trending up */
export const IconMetricReceita = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 14C10 14 9 12 9 10C9 7 12 5 16 5C20 5 23 7 23 10C23 12 22 14 22 14L24 27H8L10 14Z" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M13 9C13 9 13.5 8 16 8C18.5 8 19 9 19 9" stroke="#2563eb" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    <rect x="7" y="27" width="18" height="2.5" rx="1.25" fill="#2563eb" opacity="0.4"/>
    <path d="M14 14C14 14 14.5 13 16 13C17.5 13 18 13.7 18 14.5C18 15.3 17.2 15.8 16 16.3C14.8 16.8 14 17.3 14 18.2C14 19 14.8 19.5 16 19.5C17.2 19.5 18 18.7 18 18.7" stroke="#16a34a" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="16" y1="12.5" x2="16" y2="14" stroke="#16a34a" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="16" y1="19.5" x2="16" y2="21" stroke="#16a34a" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

/** Tarefas pendentes — relógio com lista */
export const IconMetricTarefas = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="16" cy="16" r="12" fill="#fef3c7" fillOpacity="0.5" stroke="#f59e0b" strokeWidth="1.6"/>
    <line x1="16" y1="8" x2="16" y2="16.5" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="16" y1="16.5" x2="21" y2="19" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="16" y1="5" x2="16" y2="7" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
    <line x1="27" y1="16" x2="28.5" y2="16" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
    <line x1="4" y1="16" x2="5.5" y2="16" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

/** Notificações (sino) */
export const IconBell = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M16 4C16 4 9 6 9 16V22H23V16C23 6 16 4 16 4Z" fill="#dbeafe" fillOpacity="0.5" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M7 22H25" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M13 22C13 23.657 14.343 25 16 25C17.657 25 19 23.657 19 22" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M16 4V2" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

/** Shield APIs */
export const IconShield = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M16 3L27 7V15C27 21.5 16 29 16 29C16 29 5 21.5 5 15V7L16 3Z" fill="#dcfce7" fillOpacity="0.6" stroke="#16a34a" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M11 15L14.5 18.5L21 12" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 8L22 10V15" stroke="#16a34a" strokeWidth="1" opacity="0.3" strokeLinecap="round"/>
  </svg>
);

/** Fechar / X */
export const IconClose = ({ className, size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="8" fill="#fee2e2" fillOpacity="0.5"/>
    <path d="M7 7L13 13M13 7L7 13" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

/** Logout */
export const IconLogout = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M13 5H7C5.895 5 5 5.895 5 7V25C5 26.105 5.895 27 7 27H13" stroke="#ef4444" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M21 11L27 16L21 21" stroke="#ef4444" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="27" y1="16" x2="13" y2="16" stroke="#ef4444" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
