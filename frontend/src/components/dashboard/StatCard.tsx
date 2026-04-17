import type { KpiMetric } from "../../lib/api";

function outcomeGood(metric: KpiMetric): boolean | null {
  const { change_pct, polarity } = metric;
  if (change_pct == null) return null;
  const lowerBetter = polarity === "lower_is_better";
  return lowerBetter ? change_pct <= 0 : change_pct >= 0;
}

function formatDelta(metric: KpiMetric): string {
  if (metric.change_pct == null) return "—";
  const n = metric.change_pct;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}% WoW`;
}

export function StatCard({ metric }: { metric: KpiMetric }) {
  const good = outcomeGood(metric);

  return (
    <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{metric.value}</p>
        <span
          className={
            good === null
              ? "text-xs text-slate-500"
              : good
                ? "text-xs font-medium text-emerald-400"
                : "text-xs font-medium text-rose-400"
          }
        >
          {formatDelta(metric)}
        </span>
      </div>
    </div>
  );
}
