/**
 * LEXIA — Logo Components
 *
 * LogoFull  — horizontal logo (icon + wordmark), used in landing & marketing
 * LogoMark  — icon only (scales of justice), used in sidebar & app shortcuts
 * LogoText  — text only, "ALBERTINO / Advogados Associados", used in formal docs
 */

interface LogoProps {
  className?: string;
  dark?: boolean;          // invert colors for dark backgrounds
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: { icon: 28, text: "text-sm", sub: "text-[8px]" },
  md: { icon: 40, text: "text-base", sub: "text-[10px]" },
  lg: { icon: 56, text: "text-xl", sub: "text-xs" },
  xl: { icon: 80, text: "text-3xl", sub: "text-sm" },
};

/** Scales of Justice SVG mark */
export const LogoMark = ({ className = "", dark = false, size = "md" }: LogoProps) => {
  const s = sizes[size].icon;
  const gold  = dark ? "#f5c842" : "#c8960c";
  const navy  = dark ? "#e8eef8" : "#1a2a5e";

  return (
    <svg
      width={s} height={s}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LEXIA Logo"
    >
      {/* Base pedestal */}
      <rect x="42" y="88" width="16" height="4" rx="2" fill={navy} opacity="0.9" />
      <rect x="36" y="92" width="28" height="3" rx="1.5" fill={navy} opacity="0.7" />

      {/* Vertical pole */}
      <rect x="49" y="20" width="2" height="68" rx="1" fill={navy} />

      {/* Horizontal beam */}
      <rect x="12" y="28" width="76" height="2.5" rx="1.25" fill={navy} />

      {/* Center pivot ornament */}
      <circle cx="50" cy="29" r="5" fill={gold} />
      <circle cx="50" cy="29" r="2.5" fill={navy} />

      {/* ─── Left pan ─── */}
      {/* Chain */}
      <line x1="20" y1="30" x2="20" y2="55" stroke={navy} strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Pan bowl */}
      <path d="M8 55 Q20 70 32 55" stroke={navy} strokeWidth="2" fill={gold} fillOpacity="0.25" />
      {/* Pan rim */}
      <rect x="8" y="53" width="24" height="3" rx="1.5" fill={gold} opacity="0.8" />

      {/* ─── Right pan ─── */}
      {/* Chain */}
      <line x1="80" y1="30" x2="80" y2="55" stroke={navy} strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Pan bowl */}
      <path d="M68 55 Q80 70 92 55" stroke={navy} strokeWidth="2" fill={gold} fillOpacity="0.25" />
      {/* Pan rim */}
      <rect x="68" y="53" width="24" height="3" rx="1.5" fill={gold} opacity="0.8" />

      {/* Top ornament (star/diamond) */}
      <polygon points="50,8 53,15 50,13 47,15" fill={gold} />
      <circle cx="50" cy="8" r="3" fill={gold} />
    </svg>
  );
};

/** Full horizontal logo: icon + "LEXIA" wordmark */
export const LogoFull = ({ className = "", dark = false, size = "md" }: LogoProps) => {
  const s = sizes[size];
  const gold = dark ? "#f5c842" : "#c8960c";
  const text = dark ? "text-white" : "text-[#1a2a5e]";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark dark={dark} size={size} />
      <div>
        <div className={`font-serif font-bold tracking-widest uppercase ${s.text} ${text}`}>
          LEXIA
        </div>
        <div className={`tracking-widest uppercase ${s.sub} opacity-60 ${text}`}>
          Gestão Jurídica
        </div>
      </div>
    </div>
  );
};

/** Text-only formal logo for documents/reports */
export const LogoText = ({ className = "", dark = false, size = "md" }: LogoProps) => {
  const s = sizes[size];
  const text = dark ? "text-white" : "text-[#1a2a5e]";
  const gold  = dark ? "text-[#f5c842]" : "text-[#c8960c]";

  return (
    <div className={`text-center ${className}`}>
      <div className={`font-serif font-bold tracking-[0.3em] uppercase ${s.text} ${text}`}>
        ALBERTINO
      </div>
      <div className={`tracking-[0.2em] uppercase ${s.sub} ${gold} font-medium`}>
        Advogados Associados
      </div>
    </div>
  );
};

export default LogoMark;
