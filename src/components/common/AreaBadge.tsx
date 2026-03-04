const areaStyles: Record<string, string> = {
  penal: "area-badge-penal",
  civel: "area-badge-civel",
  cível: "area-badge-civel",
  família: "area-badge-familia",
  familia: "area-badge-familia",
  "execução penal": "area-badge-execucao",
  recurso: "area-badge-recurso",
  recursos: "area-badge-recurso",
};

interface AreaBadgeProps {
  area: string;
}

export const AreaBadge = ({ area }: AreaBadgeProps) => {
  const className = areaStyles[area.toLowerCase()] || "area-badge-civel";
  return <span className={className}>{area}</span>;
};
