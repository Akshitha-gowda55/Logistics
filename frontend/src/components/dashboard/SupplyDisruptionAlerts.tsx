import type { SupplyDisruptionAlert } from "../../lib/api";

function severityStyles(sev: string) {
  if (sev === "high" || sev === "critical") {
    return "border-rose-500/35 bg-rose-950/25 ring-rose-500/20";
  }
  if (sev === "medium") {
    return "border-amber-500/35 bg-amber-950/20 ring-amber-500/15";
  }
  return "border-slate-700 bg-slate-900/50 ring-slate-600/20";
}

function typeLabel(t: string) {
  if (t === "supplier_delay") return "Supplier delay risk";
  if (t === "shipment_delay") return "Shipment delay";
  if (t === "inventory_shortage") return "Inventory shortage";
  return t.replaceAll("_", " ");
}

export function SupplyDisruptionAlerts({ alerts }: { alerts: SupplyDisruptionAlert[] }) {
  if (!alerts.length) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 text-sm text-slate-500">
        No supply disruption signals above threshold.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {alerts.map((a) => (
        <article
          key={a.detection_type}
          className={`rounded-xl border px-4 py-3 ring-1 ${severityStyles(a.severity)}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{typeLabel(a.detection_type)}</p>
          <h3 className="mt-1 font-display text-base font-semibold text-white">{a.headline}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{a.detail}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded-md bg-slate-950/70 px-2 py-0.5 font-medium capitalize text-slate-300">{a.severity}</span>
            <span>Score {(a.probability * 100).toFixed(0)}%</span>
            {a.horizon_days != null && <span>Horizon {a.horizon_days}d</span>}
          </div>
        </article>
      ))}
    </div>
  );
}
