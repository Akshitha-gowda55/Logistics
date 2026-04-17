import type { ReactNode } from "react";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 85) return "Critical";
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

const levelToClasses: Record<RiskLevel, { ring: string; bg: string; text: string }> = {
  Low: { ring: "ring-emerald-500/60", bg: "bg-emerald-900/50", text: "text-emerald-100" },
  Medium: { ring: "ring-amber-500/60", bg: "bg-amber-900/50", text: "text-amber-100" },
  High: { ring: "ring-rose-500/60", bg: "bg-rose-900/50", text: "text-rose-100" },
  Critical: { ring: "ring-red-500/70", bg: "bg-red-900/60", text: "text-red-100" },
};

export function RiskLevelBadge({ level, score, subtitle }: { level: RiskLevel; score?: number; subtitle?: string }) {
  const c = levelToClasses[level];
  return (
    <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.65rem] font-semibold ring-1", c.ring, c.bg, c.text].join(" ")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}
      {typeof score === "number" ? (
        <span className="rounded bg-black/20 px-1.5 py-0.5 text-[0.6rem] font-bold">{score}</span>
      ) : null}
      {subtitle ? <span className="text-[0.6rem] text-current/90">{subtitle}</span> : null}
    </span>
  );
}

export function RiskLevelLegend({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.7rem] text-slate-300">
      {icon}
      {text}
    </span>
  );
}

