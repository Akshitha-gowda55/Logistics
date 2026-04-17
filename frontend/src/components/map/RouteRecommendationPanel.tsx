import type { RouteDashboardRoute } from "../../lib/api";
import { formatInr } from "../../lib/formatCurrency";

function formatEta(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.max(0, Math.round((hours - h) * 60));
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export function RouteRecommendationPanel({
  routes,
  bestRouteId,
  selectedRouteId,
  onSelect,
  mapboxUsed,
}: {
  routes: RouteDashboardRoute[];
  bestRouteId: string;
  selectedRouteId: string;
  onSelect: (id: string) => void;
  mapboxUsed: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route options</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">Compare time, cost (₹), and CO₂ (kg)</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {mapboxUsed
            ? "Road geometry from Mapbox Directions (simplified)."
            : "Static India corridor polylines for fast load; enable MAPBOX + USE_MAPBOX_DIRECTIONS for live roads."}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {routes.map((r) => {
          const selected = r.id === selectedRouteId;
          const best = r.id === bestRouteId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={[
                "w-full rounded-xl border px-3 py-3 text-left transition",
                selected ? "border-slate-400 bg-slate-50 ring-1 ring-slate-300" : "border-slate-200 bg-white hover:border-slate-300",
                best ? "ring-1 ring-emerald-400/60" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{r.distance_km.toFixed(1)} km · truck model</p>
                </div>
                {best && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                    Best
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Time</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatEta(r.duration_hours)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Cost</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatInr(r.cost_inr)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">CO₂</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{Math.round(r.co2_kg)} kg</dd>
                </div>
              </dl>
            </button>
          );
        })}
      </div>
      <div className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500">
        Best route: lowest composite score (time, ₹ cost, CO₂) when using Mapbox; demo defaults to Route 1 (lowest
        emissions example).
      </div>
    </div>
  );
}
