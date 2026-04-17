import { DemandForecastChart } from "../DemandForecastChart";
import type { DemandPoint } from "../../../data/dashboardDummy";

type ForecastPayload = {
  horizon_days: number;
  predicted_demand: number[];
  confidence: number;
  trend: string;
  recommended_action: string;
  baseline_window?: number[];
  spike_detected?: boolean;
  change_pct?: number;
};

export function ExecutiveDemandPanel({ forecast }: { forecast: ForecastPayload | null }) {
  if (!forecast) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-sm font-semibold text-slate-100">Demand Prediction</p>
        <p className="text-xs text-slate-400">Loading demand prediction…</p>
      </div>
    );
  }

  const baseline = forecast.baseline_window ?? [];
  const hist: number[] = baseline.length ? baseline : forecast.predicted_demand.slice(0, 4);
  const merged = buildSeries(hist, forecast.predicted_demand);
  const change = forecast.change_pct ?? 0;
  const spike = !!forecast.spike_detected;

  const changeLabel =
    change > 0 ? `+${change.toFixed(1)}% vs base` : `${change.toFixed(1)}% vs base`;

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Demand Prediction</p>
          <p className="mt-1 text-xs text-slate-400">
            Demand for next {forecast.horizon_days} days, with confidence and spike check.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p className={change > 4 ? "font-semibold text-emerald-300" : change < -4 ? "font-semibold text-amber-300" : ""}>
            {changeLabel}
          </p>
          <p className="mt-0.5">
            Confidence: <span className="font-mono text-sky-300">{Math.round(forecast.confidence * 100)}%</span>
          </p>
        </div>
      </div>

      {spike ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
          <p>
            <span className="font-semibold">Demand spike found.</span> Check capacity and increase safety stock where needed.
          </p>
        </div>
      ) : null}

      <DemandForecastChart data={merged} />

      <div className="mt-1 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
        <p className="font-semibold text-slate-100">Suggested Stock Action</p>
        <p className="mt-1 text-[0.72rem] text-slate-300">{forecast.recommended_action}</p>
      </div>
    </div>
  );
}

function buildSeries(history: number[], future: number[]): DemandPoint[] {
  const rows: DemandPoint[] = [];
  history.forEach((v, idx) => {
    rows.push({ week: `D-${history.length - idx}`, actual: v, forecast: v });
  });
  future.forEach((v, idx) => {
    rows.push({ week: `D+${idx + 1}`, actual: null, forecast: v });
  });
  return rows;
}

