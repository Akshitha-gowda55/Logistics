import { formatScenarioLogisticsCostInr, formatSignedInrRupees } from "../../../lib/formatCurrency";

type ScenarioKpis = {
  logistics_cost_musd: number;
  eta_impact_hours: number;
  service_level_pct: number;
  inventory_shortage_units: number;
  supplier_risk_index: number;
};

type ScenarioResponse = {
  scenario: string;
  scenario_name: string;
  baseline: ScenarioKpis;
  after: ScenarioKpis;
  delta: Record<string, number>;
};

export function BeforeAfterKpiGrid({ sim }: { sim: ScenarioResponse | null }) {
  if (!sim) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-400 text-center">
        Select a scenario to view KPI impact.
      </div>
    );
  }

  const b = sim.baseline;
  const a = sim.after;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Kpi
        title="Logistics cost (₹)"
        baseline={formatScenarioLogisticsCostInr(b.logistics_cost_musd)}
        after={formatScenarioLogisticsCostInr(a.logistics_cost_musd)}
        delta={a.logistics_cost_musd - b.logistics_cost_musd}
        formatDelta={(d) => formatSignedInrRupees(d * 1e7)}
        polarity="upBad"
      />
      <Kpi title="ETA impact" baseline={`${b.eta_impact_hours.toFixed(0)}h`} after={`${a.eta_impact_hours.toFixed(0)}h`} delta={a.eta_impact_hours - b.eta_impact_hours} polarity="upBad" />
      <Kpi title="Service level" baseline={`${b.service_level_pct.toFixed(1)}%`} after={`${a.service_level_pct.toFixed(1)}%`} delta={a.service_level_pct - b.service_level_pct} polarity="downBad" />
      <Kpi title="Inventory shortage" baseline={`${b.inventory_shortage_units}`} after={`${a.inventory_shortage_units}`} delta={a.inventory_shortage_units - b.inventory_shortage_units} polarity="upBad" />
      <Kpi title="Supplier risk" baseline={`${b.supplier_risk_index.toFixed(0)}`} after={`${a.supplier_risk_index.toFixed(0)}`} delta={a.supplier_risk_index - b.supplier_risk_index} polarity="upBad" />
    </div>
  );
}

function Kpi({
  title,
  baseline,
  after,
  delta,
  polarity,
  formatDelta,
}: {
  title: string;
  baseline: string;
  after: string;
  delta: number;
  polarity: "upBad" | "downBad";
  formatDelta?: (delta: number) => string;
}) {
  const isBad = polarity === "upBad" ? delta > 0 : delta < 0;
  const pill = isBad ? "bg-rose-900/50 ring-rose-500/50 text-rose-100" : "bg-emerald-900/50 ring-emerald-500/50 text-emerald-100";
  const sign = delta > 0 ? "+" : "";
  const deltaText = formatDelta ? formatDelta(delta) : `${sign}${delta.toFixed(1)}`;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-slate-400">Before: <span className="font-semibold text-slate-100">{baseline}</span></p>
        <p className="text-slate-400">After: <span className="font-semibold text-slate-100">{after}</span></p>
        <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ${pill}`}>
          Δ {deltaText}
        </span>
      </div>
    </div>
  );
}

