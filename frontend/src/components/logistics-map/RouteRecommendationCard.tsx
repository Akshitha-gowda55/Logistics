import type { RouteRecommendationItem } from "../../lib/api";
import { formatInr } from "../../lib/formatCurrency";

function pct(x: number) {
  return `${Math.round(_clamp(x, 0, 1) * 100)}%`;
}

function _clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function riskPill(label: string) {
  const l = label.toLowerCase();
  if (l.includes("high")) return "bg-rose-900/55 ring-rose-500/55 text-rose-100";
  if (l.includes("medium")) return "bg-amber-900/55 ring-amber-500/55 text-amber-100";
  return "bg-emerald-900/55 ring-emerald-500/55 text-emerald-100";
}

function laneBadgeText(route: RouteRecommendationItem): string {
  if (route.route_lane === "fast") return "Fast route";
  if (route.route_lane === "eco") return "Eco route";
  return "Best route";
}

export function RouteRecommendationCard({
  route,
  badge,
  onSelect,
}: {
  route: RouteRecommendationItem;
  badge?: "Best" | "Alternate";
  onSelect?: () => void;
}) {
  const ribbon = badge === "Alternate" ? "Other route" : laneBadgeText(route);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            {route.route_code} · {route.mode.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Carrier: <span className="font-semibold text-slate-200">{route.carrier_suggestion}</span>
          </p>
        </div>
        <span className="rounded-full bg-sky-600 px-3 py-1 text-[0.65rem] font-semibold text-white">{ribbon}</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
        <Metric label="ETA" value={`${route.eta_hours.toFixed(1)}h`} />
        <Metric label="Distance" value={`${route.distance_km.toFixed(0)} km`} />
        <Metric label="Cost (₹)" value={formatInr(route.cost_usd)} />
        <Metric label="CO₂" value={`${Math.round(route.co2_kg)} kg`} />
        <Metric label="Reliability" value={pct(route.reliability)} />
        <Metric label="Capacity" value={`${route.capacity_units} units`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem]">
        <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${riskPill(route.delay_risk)}`}>
          Delay risk: {route.delay_risk} ({pct(route.delay_probability)})
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${riskPill(route.disruption_risk)}`}>
          Problem risk: {route.disruption_risk} ({pct(route.disruption_probability)})
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
        <p className="font-semibold text-slate-100">Why this route</p>
        <p className="mt-1">{route.explanation}</p>
      </div>

      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="mt-3 inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          Use This Route
        </button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

