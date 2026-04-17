import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KPISnapshot } from "../../lib/api";
import { formatInr } from "../../lib/formatCurrency";

const beforeFill = "#64748b";
const afterFill = "#3b82f6";

function MiniBar({
  title,
  unit,
  baseline,
  simulated,
  decimals = 1,
  formatTooltipValue,
}: {
  title: string;
  unit: string;
  baseline: number;
  simulated: number;
  decimals?: number;
  formatTooltipValue?: (v: number) => string;
}) {
  const data = [
    { label: "Before", value: baseline },
    { label: "After", value: simulated },
  ];
  const lo = Math.min(baseline, simulated);
  const hi = Math.max(baseline, simulated);
  const pad = (hi - lo) * 0.15 + (hi * 0.02 || 1);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{unit}</p>
      <div className="mt-3 h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#334155" }} tickLine={false} />
            <YAxis
              domain={[Math.max(0, lo - pad), hi + pad]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(decimals)}
              width={44}
            />
            <Tooltip
              formatter={(v: number) => [(formatTooltipValue ? formatTooltipValue(v) : v.toFixed(decimals)), ""]}
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
              <Cell fill={beforeFill} />
              <Cell fill={afterFill} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ScenarioBeforeAfterCharts({ baseline, simulated }: { baseline: KPISnapshot; simulated: KPISnapshot }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MiniBar
        title="Service level"
        unit="Percent (higher is better)"
        baseline={baseline.service_level_pct}
        simulated={simulated.service_level_pct}
        decimals={1}
      />
      <MiniBar
        title="Cost"
        unit="₹ Crore / period (1.0 = ₹1 Cr)"
        baseline={baseline.cost_crore_inr}
        simulated={simulated.cost_crore_inr}
        decimals={2}
        formatTooltipValue={(v) => formatInr(v * 1e7)}
      />
      <MiniBar
        title="Delay"
        unit="Late / at-risk shipments (count)"
        baseline={baseline.delay_shipments}
        simulated={simulated.delay_shipments}
        decimals={0}
      />
      <MiniBar
        title="CO₂"
        unit="Tonnes CO₂e / period"
        baseline={baseline.co2_tonnes}
        simulated={simulated.co2_tonnes}
        decimals={0}
      />
    </div>
  );
}
