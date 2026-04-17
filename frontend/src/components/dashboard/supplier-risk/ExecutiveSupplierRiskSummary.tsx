import { SupplierScoreCards } from "./SupplierScoreCards";
import { SupplierRiskTrendChart } from "./SupplierRiskTrendChart";

type TrendPoint = { week: string; score: number };

type Supplier = {
  supplier: string;
  region: string;
  risk_score: number;
  risk_level: string;
  delay_probability: number;
  recommendation?: string;
  trend?: TrendPoint[];
};

type SupplierRiskResponse = {
  suppliers: Supplier[];
  recommended_mitigation: string;
  alternate_supplier?: { supplier: string; reason: string } | null;
};

export function ExecutiveSupplierRiskSummary({ risk }: { risk: SupplierRiskResponse | null }) {
  const suppliers = risk?.suppliers ?? [];
  const top = suppliers[0];
  const trend = top?.trend ?? [];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Supplier Risk</p>
          <p className="mt-1 text-xs text-slate-400">See early risk, delay chance, and fix suggestions.</p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">Loading supplier risk…</p>
      ) : (
        <div className="mt-3 space-y-3">
          <SupplierScoreCards suppliers={suppliers as any[]} />
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Risk Trend (Main Supplier)</p>
            <div className="mt-2">
              <SupplierRiskTrendChart data={trend} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Fix Suggestion</p>
            <p className="mt-1">{risk?.recommended_mitigation ?? "—"}</p>
            {risk?.alternate_supplier ? (
              <p className="mt-2 text-[0.7rem] text-slate-400">
                Backup supplier: <span className="font-semibold text-sky-200">{risk.alternate_supplier.supplier}</span> · {risk.alternate_supplier.reason}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

