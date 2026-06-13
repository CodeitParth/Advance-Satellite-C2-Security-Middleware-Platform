import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

type StatVariant = "default" | "blue" | "green" | "amber" | "red" | "purple";

const VARIANT_STYLES: Record<StatVariant, { bg: string; accent: string; iconBg: string }> = {
  default: {
    bg:     "bg-surface-1 border-border",
    accent: "text-content-primary",
    iconBg: "bg-surface-2 text-content-secondary",
  },
  blue: {
    bg:     "bg-kpi-blue border-accent-border",
    accent: "text-accent",
    iconBg: "bg-accent-subtle text-accent",
  },
  green: {
    bg:     "bg-kpi-green border-success-border",
    accent: "text-success",
    iconBg: "bg-success-subtle text-success",
  },
  amber: {
    bg:     "bg-kpi-amber border-warning-border",
    accent: "text-warning",
    iconBg: "bg-warning-subtle text-warning",
  },
  red: {
    bg:     "bg-kpi-red border-danger-border",
    accent: "text-danger",
    iconBg: "bg-danger-subtle text-danger",
  },
  purple: {
    bg:     "bg-kpi-purple border-security-border",
    accent: "text-security",
    iconBg: "bg-security-subtle text-security",
  },
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  variant?: StatVariant;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = "default",
  trend,
  trendValue,
}: StatCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={clsx(
        "flex flex-col gap-2 p-4 rounded-md border transition-colors duration-150",
        styles.bg,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-content-muted font-medium truncate">{label}</p>
        </div>
        <div className={clsx("flex items-center justify-center w-8 h-8 rounded shrink-0", styles.iconBg)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <div className={clsx("text-5xl font-bold tabular-nums leading-none", styles.accent)}>
          {value}
        </div>
        {(sub || trend) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {trend && trendValue && (
              <span
                className={clsx(
                  "text-2xs font-semibold",
                  trend === "up"   ? "text-success" : "",
                  trend === "down" ? "text-danger"  : "",
                  trend === "flat" ? "text-content-muted" : "",
                )}
              >
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
              </span>
            )}
            {sub && <span className="text-xs text-content-muted">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
