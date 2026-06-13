// KpiTile — compact KPI strip tile used by the simulation pages.
import { clsx } from "clsx";

export type KpiTone = "default" | "green" | "amber" | "red" | "blue" | "purple";

const TONE_CLS: Record<KpiTone, string> = {
  default: "text-content-primary",
  green:   "text-success",
  amber:   "text-warning",
  red:     "text-danger",
  blue:    "text-accent",
  purple:  "text-security",
};

export function KpiTile({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  icon: React.ElementType;
  tone?: KpiTone;
}) {
  return (
    <div className="card px-3 py-2.5 flex flex-col justify-between min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-content-muted shrink-0" />
        <span className="text-2xs text-content-muted uppercase tracking-widest truncate">{label}</span>
      </div>
      <div className="mt-1">
        <span className={clsx("font-mono text-xl font-bold tabular-nums leading-none", TONE_CLS[tone])}>{value}</span>
        {unit && <span className="text-2xs text-content-muted ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-2xs text-content-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export default KpiTile;
