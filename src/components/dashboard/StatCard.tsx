import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "accent";
}

export const StatCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) => {
  return (
    <div className={`stat-card ${variant === "accent" ? "border-accent/30 bg-accent/5" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-bold mt-0.5 leading-none" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '-0.01em' }}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1 font-semibold ${trend.positive ? "text-emerald-600" : "text-destructive"}`}>
              {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-primary/8 shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </div>
  );
};
