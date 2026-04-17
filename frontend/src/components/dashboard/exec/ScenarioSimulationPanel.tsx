import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { ScenarioCards, type ScenarioId } from "../scenario/ScenarioCards";
import { BeforeAfterKpiGrid } from "../scenario/BeforeAfterKpiGrid";
import { ImpactSummaryChart } from "../scenario/ImpactSummaryChart";
import { PlaybookPanel } from "../scenario/PlaybookPanel";

type ScenarioKpis = {
  logistics_cost_musd: number;
  eta_impact_hours: number;
  service_level_pct: number;
  inventory_shortage_units: number;
  supplier_risk_index: number;
};

type ScenarioResponse = {
  scenario: ScenarioId;
  scenario_name: string;
  baseline: ScenarioKpis;
  after: ScenarioKpis;
  delta: Record<string, number>;
  chart: Array<{ metric: string; baseline: number; after: number }>;
  playbook: string;
  recommended_actions: string[];
};

export function ScenarioSimulationPanel() {
  const { token } = useAuth();
  const [selected, setSelected] = useState<ScenarioId>("supplier_delay");
  const [sim, setSim] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    api
      .scenario(token, selected)
      .then((s) => setSim(s as ScenarioResponse))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not run test"))
      .finally(() => setLoading(false));
  }, [token, selected]);

  const chartData = useMemo(() => sim?.chart ?? [], [sim]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">What-If Test</p>
          <p className="mt-1 text-xs text-slate-400">Test possible problems and see fix steps.</p>
        </div>
        <div className="text-xs text-slate-400">{loading ? "Running…" : sim ? sim.scenario_name : ""}</div>
      </div>

      <div className="mt-3">
        <ScenarioCards selected={selected} onSelect={setSelected} />
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-100">{error}</div>
      ) : null}

      <div className="mt-4 space-y-4">
        <BeforeAfterKpiGrid sim={sim} />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Impact Summary</p>
            <div className="mt-2">
              <ImpactSummaryChart data={chartData} />
            </div>
          </div>
          <PlaybookPanel playbook={sim?.playbook ?? ""} actions={sim?.recommended_actions ?? []} />
        </div>
      </div>
    </div>
  );
}

