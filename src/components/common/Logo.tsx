import { useBrand } from "@/contexts/BrandContext";

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

/**
 * Caixa da marca por tamanho. A altura vive no contêiner, não na imagem:
 * uma altura fixa em pixels na própria logo corta as verticais e as de várias
 * linhas, que só cabem inteiras quando podem encolher pela largura.
 */
const logoBoxes: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "max-h-7 max-w-[140px]",
  md: "max-h-10 max-w-[220px]",
  lg: "max-h-14 max-w-[280px]",
  xl: "max-h-20 max-w-[360px]",
};

/** Scales of Justice SVG mark */
export const LogoMark = ({ className = "", dark = false, size = "md" }: LogoProps) => {
  const { brand } = useBrand();
  const s = sizes[size].icon;
  const iconPath = brand.iconPath;
  const accent = dark ? "#ffffff" : "hsl(var(--primary))";
  const foreground = dark ? "#e8eef8" : "hsl(var(--foreground))";

  if (iconPath) {
    return (
      <img
        src={iconPath}
        alt=""
        width={s}
        height={s}
        className={`object-contain ${className}`}
      />
    );
  }

  return (
    <svg
      width={s} height={s}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`Logo ${brand.publicName}`}
    >
      {/* Base pedestal */}
      <rect x="42" y="88" width="16" height="4" rx="2" fill={foreground} opacity="0.9" />
      <rect x="36" y="92" width="28" height="3" rx="1.5" fill={foreground} opacity="0.7" />

      {/* Vertical pole */}
      <rect x="49" y="20" width="2" height="68" rx="1" fill={foreground} />

      {/* Horizontal beam */}
      <rect x="12" y="28" width="76" height="2.5" rx="1.25" fill={foreground} />

      {/* Center pivot ornament */}
      <circle cx="50" cy="29" r="5" fill={accent} />
      <circle cx="50" cy="29" r="2.5" fill={foreground} />

      {/* ─── Left pan ─── */}
      {/* Chain */}
      <line x1="20" y1="30" x2="20" y2="55" stroke={foreground} strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Pan bowl */}
      <path d="M8 55 Q20 70 32 55" stroke={foreground} strokeWidth="2" fill={accent} fillOpacity="0.25" />
      {/* Pan rim */}
      <rect x="8" y="53" width="24" height="3" rx="1.5" fill={accent} opacity="0.8" />

      {/* ─── Right pan ─── */}
      {/* Chain */}
      <line x1="80" y1="30" x2="80" y2="55" stroke={foreground} strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Pan bowl */}
      <path d="M68 55 Q80 70 92 55" stroke={foreground} strokeWidth="2" fill={accent} fillOpacity="0.25" />
      {/* Pan rim */}
      <rect x="68" y="53" width="24" height="3" rx="1.5" fill={accent} opacity="0.8" />

      {/* Top ornament (star/diamond) */}
      <polygon points="50,8 53,15 50,13 47,15" fill={accent} />
      <circle cx="50" cy="8" r="3" fill={accent} />
    </svg>
  );
};

export const LogoFull = ({ className = "", dark = false, size = "md" }: LogoProps) => {
  const { brand } = useBrand();
  const s = sizes[size];
  const text = dark ? "text-white" : "text-foreground";
  const logoPath = dark
    ? brand.logoDarkPath ?? brand.logoLightPath
    : brand.logoLightPath ?? brand.logoDarkPath;

  if (logoPath) {
    return (
      <span
        className={`inline-flex items-center justify-center ${logoBoxes[size]}`}
      >
        <img
          src={logoPath}
          alt={brand.publicName}
          className={`h-auto w-auto max-h-full max-w-full object-contain ${className}`}
        />
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark dark={dark} size={size} />
      <div>
        <div className={`font-serif font-bold tracking-widest uppercase ${s.text} ${text}`}>
          {brand.publicName}
        </div>
        <div className={`tracking-widest uppercase ${s.sub} opacity-60 ${text}`}>
          Gestão Jurídica
        </div>
      </div>
    </div>
  );
};

export const LogoText = ({ className = "", dark = false, size = "md" }: LogoProps) => {
  const { brand } = useBrand();
  const s = sizes[size];
  const text = dark ? "text-white" : "text-foreground";
  const accent = dark ? "text-white/80" : "text-primary";

  return (
    <div className={`text-center ${className}`}>
      <div className={`font-serif font-bold tracking-[0.3em] uppercase ${s.text} ${text}`}>
        {brand.publicName}
      </div>
      <div className={`tracking-[0.2em] uppercase ${s.sub} ${accent} font-medium`}>
        Gestão Jurídica
      </div>
    </div>
  );
};

export default LogoMark;
