import { RiskLevelBadge, riskLevelFromScore } from "./RiskLevelBadge";

type SupplierRiskSupplier = {
  supplier: string;
  region: string;
  risk_score: number;
  risk_level: string;
  delay_probability: number;
};

export function SupplierScoreCards({ suppliers, onSelect }: { suppliers: SupplierRiskSupplier[]; onSelect?: (s: SupplierRiskSupplier) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {suppliers.slice(0, 4).map((s) => {
        const level = riskLevelFromScore(Number(s.risk_score ?? 0));
        const tone =
          level === "Critical"
            ? "border-red-500/40 bg-red-950/20"
            : level === "High"
              ? "border-rose-500/40 bg-rose-950/20"
              : level === "Medium"
                ? "border-amber-500/40 bg-amber-950/20"
                : "border-slate-800 bg-slate-950/40";

        return (
          <button
            type="button"
            key={s.supplier}
            onClick={() => onSelect?.(s)}
            className={`rounded-xl border p-3 text-left transition hover:border-sky-600/60 ${tone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{s.supplier}</p>
                <p className="mt-1 text-[0.7rem] text-slate-400">{s.region} region</p>
              </div>
              <RiskLevelBadge level={level} score={Number(s.risk_score)} subtitle={s.risk_level} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[0.7rem]">
              <Metric label="Delay probability" value={`${Math.round((s.delay_probability ?? 0) * 100)}%`} />
              <Metric label="Risk score" value={Number(s.risk_score).toFixed(0)} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

