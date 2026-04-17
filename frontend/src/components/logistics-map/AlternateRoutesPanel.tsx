import type { RouteRecommendationItem } from "../../lib/api";
import { formatInr } from "../../lib/formatCurrency";

function pct(x: number) {
  return `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
}

export function AlternateRoutesPanel({
  routes,
  selectedRouteCode,
  onSelect,
}: {
  routes: RouteRecommendationItem[];
  selectedRouteCode: string;
  onSelect: (routeCode: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-sm font-semibold text-slate-100">Other Routes</p>
      <p className="mt-1 text-xs text-slate-400">Compare other route options.</p>
      <div className="mt-3 space-y-2">
        {routes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
            No other routes available.
          </div>
        ) : (
          routes.map((r) => {
            const active = r.route_code === selectedRouteCode;
            return (
              <button
                key={r.route_code}
                type="button"
                onClick={() => onSelect(r.route_code)}
                className={[
                  "w-full rounded-xl border px-3 py-3 text-left transition",
                  active ? "border-sky-500 bg-sky-950/30" : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{r.route_code}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-400">
                      {r.mode.toUpperCase()} · {r.distance_km.toFixed(0)} km · {r.eta_hours.toFixed(1)}h
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[0.65rem] text-slate-200">
                    score {r.score.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[0.7rem] text-slate-300">
                  <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                    <p className="text-slate-500">Cost (₹)</p>
                    <p className="mt-0.5 font-semibold">{formatInr(r.cost_usd)}</p>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                    <p className="text-slate-500">CO₂</p>
                    <p className="mt-0.5 font-semibold">{Math.round(r.co2_kg)} kg</p>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                    <p className="text-slate-500">Reliability</p>
                    <p className="mt-0.5 font-semibold">{pct(r.reliability)}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

