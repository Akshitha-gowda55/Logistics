type InventoryInsightsSummary = {
  summary?: {
    warehouse_count: number;
    low_stock_count: number;
    excess_stock_count: number;
    network_stock: number;
    network_safety_stock: number;
    network_reorder_point: number;
    forecast_horizon_days?: number;
    network_projected_daily_demand?: number;
  };
  rebalancing_recommendation?: string;
};

export function ExecutiveInventorySummary({ insights }: { insights: InventoryInsightsSummary | null }) {
  const summary = insights?.summary;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Inventory Summary</p>
          <p className="mt-1 text-xs text-slate-400">See low stock, extra stock, and move-stock view.</p>
        </div>
      </div>

      {!summary ? (
        <p className="mt-3 text-xs text-slate-400">Loading inventory summary…</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
            <p>
              Forecast daily demand:{" "}
              <span className="font-semibold text-sky-200">{summary.network_projected_daily_demand ?? "—"}</span> / day
            </p>
            <p className="text-slate-400">Horizon: {summary.forecast_horizon_days ?? "—"} days</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <SummaryCard title="Warehouses" value={summary.warehouse_count} tone="slate" />
            <SummaryCard title="Low stock" value={summary.low_stock_count} tone="rose" />
            <SummaryCard title="Excess stock" value={summary.excess_stock_count} tone="emerald" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <SummaryCard title="Network stock" value={summary.network_stock} tone="slate" />
            <SummaryCard title="Safety stock" value={summary.network_safety_stock} tone="amber" />
            <SummaryCard title="Reorder point" value={summary.network_reorder_point} tone="sky" />
          </div>
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Move Stock Suggestion</p>
            <p className="mt-1">{insights?.rebalancing_recommendation ?? "No move-stock suggestion available."}</p>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: number; tone: "slate" | "rose" | "emerald" | "amber" | "sky" }) {
  const palette =
    tone === "rose"
      ? "border-rose-500/30 bg-rose-950/20 text-rose-100"
      : tone === "emerald"
        ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-950/20 text-amber-100"
          : tone === "sky"
            ? "border-sky-500/30 bg-sky-950/20 text-sky-100"
            : "border-slate-800 bg-slate-950/40 text-slate-100";

  return (
    <div className={`rounded-lg border p-3 ${palette}`}>
      <p className="text-[0.7rem] opacity-80">{title}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

