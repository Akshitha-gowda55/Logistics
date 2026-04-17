import type { ReactNode } from "react";
import type { RiskLevel } from "./RiskLevelBadge";
import { RiskLevelBadge } from "./RiskLevelBadge";

type SupplierRow = {
  supplier: string;
  region?: string;
  risk_score: number;
  risk_level: string;
  delay_probability: number;
  recommendation?: string;
};

function riskLevelFromApi(apiLevel: string): RiskLevel {
  const x = apiLevel.toLowerCase();
  if (x.includes("critical")) return "Critical";
  if (x.includes("high")) return "High";
  if (x.includes("medium")) return "Medium";
  return "Low";
}

function fallbackText(node: ReactNode) {
  return node;
}

export function SupplierComparisonTable({ suppliers }: { suppliers: SupplierRow[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Supplier Comparison</p>

      {suppliers.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-[0.7rem] text-slate-500">
          No supplier data available.
        </div>
      ) : (
        <div className="mt-3 overflow-auto rounded-lg border border-slate-800/60">
          <table className="min-w-[640px] w-full border-collapse">
            <thead className="bg-slate-900/60">
              <tr className="text-left text-[0.7rem] text-slate-300">
                <th className="p-3 font-semibold">Supplier</th>
                <th className="p-3 font-semibold">Region</th>
                <th className="p-3 font-semibold">Risk</th>
                <th className="p-3 font-semibold">Risk Score</th>
                <th className="p-3 font-semibold">Delay Chance</th>
                <th className="p-3 font-semibold">Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.slice(0, 10).map((s, idx) => {
                const level = riskLevelFromApi(s.risk_level);
                return (
                  <tr key={`${s.supplier}-${idx}`} className="border-t border-slate-800/60 text-[0.75rem] text-slate-200">
                    <td className="p-3 font-medium text-slate-100">{fallbackText(s.supplier)}</td>
                    <td className="p-3 text-slate-300">{s.region ?? "—"}</td>
                    <td className="p-3">
                      <RiskLevelBadge level={level} score={Number(s.risk_score)} subtitle={s.risk_level} />
                    </td>
                    <td className="p-3 text-slate-300">{Number(s.risk_score).toFixed(0)}</td>
                    <td className="p-3 text-slate-300">{Math.round((Number(s.delay_probability) ?? 0) * 100)}%</td>
                    <td className="p-3 text-slate-300">{s.recommendation ? <span className="line-clamp-2">{s.recommendation}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

