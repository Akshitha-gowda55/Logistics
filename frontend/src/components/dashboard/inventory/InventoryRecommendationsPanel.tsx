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

type Forecast = {
  horizon_days: number;
  predicted_demand: number[];
  confidence: number;
  trend: string;
  recommended_action: string;
};

export function InventoryRecommendationsPanel({
  inventoryInsights,
  forecast,
}: {
  inventoryInsights: InventoryInsights | null;
  forecast: Forecast | null;
}) {
  const warehouses = inventoryInsights?.warehouses ?? [];
  const shortage = warehouses.filter((w) => w.status === "shortage");
  const overstock = warehouses.filter((w) => w.status === "overstock");

  const horizon = forecast?.horizon_days ?? 7;
  const confidencePct = forecast?.confidence != null ? Math.round(forecast.confidence * 100) : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
        Safety and Reorder Suggestions
      </p>

      <div className="mt-2 space-y-2 text-xs">
        {forecast ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
            <p className="font-semibold text-slate-100">Forecast Info</p>
            <p className="mt-1 text-slate-400">
              Next {horizon} days · Confidence: {confidencePct != null ? `${confidencePct}%` : "—"} · Trend:{" "}
              {forecast.trend}
            </p>
          </div>
        ) : null}

        <RecommendationBlock
          title="Safety stock (for demand changes)"
          tone="rose"
          items={shortage}
          compute={(w) => Math.max(0, w.safety_stock - w.stock_level)}
          subtitle={(w) => `Target safety: ${w.safety_stock} · Current: ${w.stock_level}`}
          emptyTitle="No shortage found"
          emptyDesc="No need to refill safety stock now."
        />

        <RecommendationBlock
          title="Reorder points (when to refill)"
          tone="amber"
          items={shortage}
          compute={(w) => Math.max(0, w.reorder_point - w.stock_level)}
          subtitle={(w) => `Reorder point: ${w.reorder_point} · Current: ${w.stock_level}`}
          emptyTitle="No reorder needed"
          emptyDesc="All warehouses are above reorder points."
        />

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
          <p className="font-semibold text-slate-100">Move Stock</p>
          <p className="mt-1 text-slate-400">
            {inventoryInsights?.rebalancing_recommendation ?? "No move-stock suggestions available."}
          </p>
          {overstock.length > 0 && (
            <p className="mt-2 text-[0.7rem] text-slate-500">
              Extra stock at: {overstock.map((w) => w.name).slice(0, 3).join(", ")}
              {overstock.length > 3 ? ` +${overstock.length - 3} more` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationBlock<T extends WarehouseSummary>({
  title,
  items,
  tone,
  compute,
  subtitle,
  emptyTitle,
  emptyDesc,
}: {
  title: string;
  tone: "rose" | "amber";
  items: T[];
  compute: (w: T) => number;
  subtitle: (w: T) => string;
  emptyTitle: string;
  emptyDesc: string;
}) {
  const palette =
    tone === "rose"
      ? { pill: "bg-rose-900/60 ring-rose-500/60 text-rose-100" }
      : { pill: "bg-amber-900/60 ring-amber-500/60 text-amber-100" };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-100">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ${palette.pill}`}>
          {items.length} warehouses
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-2 rounded border border-dashed border-slate-800 bg-slate-950/20 p-2 text-[0.75rem] text-slate-400">
          <p className="font-semibold text-slate-200">{emptyTitle}</p>
          <p className="mt-1">{emptyDesc}</p>
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          {items.slice(0, 3).map((w) => {
            const qty = compute(w);
            return (
              <div key={w.name} className="rounded bg-slate-950/30 px-2 py-2">
                <p className="text-slate-200">{w.name}</p>
                <p className="mt-1 text-slate-500">
                  Suggested action: +{qty} units
                </p>
                <p className="mt-1 text-[0.7rem] text-slate-500">{subtitle(w)}</p>
              </div>
            );
          })}
          {items.length > 3 ? (
            <p className="text-[0.65rem] text-slate-500">+{items.length - 3} more warehouse suggestions</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

