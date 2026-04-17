import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Forecast = {
  horizon_days: number;
  predicted_demand: number[];
  confidence: number;
  trend: string;
  recommended_action: string;
};

type WarehouseSummary = {
  name: string;
  stock_level: number;
  safety_stock: number;
  reorder_point: number;
  status: "normal" | "shortage" | "overstock" | string;
};

type InventoryInsights = {
  warehouses: WarehouseSummary[];
  rebalancing_recommendation: string;
};

export function ForecastVsStockChart({
  inventoryInsights,
  forecast,
}: {
  inventoryInsights: InventoryInsights | null;
  forecast: Forecast | null;
}) {
  const warehouses = inventoryInsights?.warehouses ?? [];
  const predicted = forecast?.predicted_demand ?? [];

  const totalStock = warehouses.reduce((s, w) => s + (w.stock_level ?? 0), 0);
  const totalSafety = warehouses.reduce((s, w) => s + (w.safety_stock ?? 0), 0);
  const totalReorder = warehouses.reduce((s, w) => s + (w.reorder_point ?? 0), 0);

  const data = useMemoData(totalStock, totalSafety, totalReorder, predicted);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-400 text-center">
        Demand vs stock chart will show when data is ready.
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2937" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="demand" name="Predicted demand" fill="#3b82f6" opacity={0.55} />
          <Line type="monotone" dataKey="remaining" name="Stock left" stroke="#94a3b8" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="reorder" name="Reorder point" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="safety" name="Safety stock" stroke="#22c55e" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem] text-slate-500">
        <LegendItem swatch="bg-blue-500" label="Predicted demand" />
        <LegendItem swatch="bg-slate-400" label="Stock left" />
        <LegendItem swatch="bg-amber-500" label="Reorder point" />
        <LegendItem swatch="bg-emerald-500" label="Safety stock" />
      </div>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}

function useMemoData(totalStock: number, totalSafety: number, totalReorder: number, predicted: number[]) {
  // Keep it deterministic without hooks to avoid extra complexity.
  if (!predicted.length) return [];
  let consumed = 0;
  return predicted.map((demand, i) => {
    consumed += demand;
    const remaining = totalStock - consumed;
    return {
      t: `D+${i + 1}`,
      demand,
      remaining: Number(remaining.toFixed(0)),
      safety: Number(totalSafety.toFixed(0)),
      reorder: Number(totalReorder.toFixed(0)),
    };
  });
}

