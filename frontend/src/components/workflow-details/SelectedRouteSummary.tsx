import type { WorkflowShipmentDetails } from "../../lib/api";
import { formatInr } from "../../lib/formatCurrency";

function riskPill(risk: string) {
  const l = (risk || "low").toLowerCase();
  if (l.includes("high")) return "bg-rose-900/55 ring-rose-500/55 text-rose-100";
  if (l.includes("medium")) return "bg-amber-900/55 ring-amber-500/55 text-amber-100";
  return "bg-emerald-900/55 ring-emerald-500/55 text-emerald-100";
}

export function SelectedRouteSummary({ shipment }: { shipment: WorkflowShipmentDetails | null }) {
  const r = shipment?.selected_route;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-semibold text-slate-100">Selected Route</p>
      <p className="mt-1 text-xs text-slate-400">Route now used for this shipment.</p>
      {!r ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-500 text-center">
          No route selected yet.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">{r.route_code}</p>
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ${riskPill(r.disruption_risk)}`}>
              Problem risk: {r.disruption_risk}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <Metric label="ETA" value={`${r.eta_hours.toFixed(1)}h`} />
            <Metric label="Distance" value={`${r.distance_km.toFixed(0)} km`} />
            <Metric label="Cost (₹)" value={formatInr(r.cost_usd)} />
            <Metric label="CO₂" value={`${Math.round(r.co2_kg)} kg`} />
          </div>
        </div>
      )}
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

