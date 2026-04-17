import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatInr } from "../../../lib/formatCurrency";

type Row = { metric: string; baseline: number; after: number };

export function ImpactSummaryChart({ data }: { data: Row[] }) {
  if (!data.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-500 text-center">
        Impact chart will appear after scenario selection.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2937" vertical={false} />
          <XAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip
            formatter={(value: number, name: string, item: { payload?: Row }) => {
              const metric = item?.payload?.metric ?? "";
              if (metric.includes("Cost")) {
                return [formatInr(Number(value) * 1e7), name];
              }
              if (metric.includes("ETA")) {
                return [`${Number(value).toFixed(1)} h`, name];
              }
              if (metric.includes("Service")) {
                return [`${Number(value).toFixed(1)}%`, name];
              }
              if (metric.includes("Shortage")) {
                return [`${Number(value).toFixed(0)} units`, name];
              }
              if (metric.includes("risk") || metric.includes("Risk")) {
                return [`${Number(value).toFixed(1)}`, name];
              }
              return [String(value), name];
            }}
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="baseline" name="Before" fill="#64748b" opacity={0.65} />
          <Bar dataKey="after" name="After" fill="#3b82f6" opacity={0.75} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

