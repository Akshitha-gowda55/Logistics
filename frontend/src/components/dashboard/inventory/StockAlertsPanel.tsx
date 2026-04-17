type WarehouseSummary = {
  name: string;
  stock_level: number;
  safety_stock: number;
  reorder_point: number;
  status: "normal" | "shortage" | "overstock" | string;
};

export function StockAlertsPanel({ warehouses }: { warehouses: WarehouseSummary[] }) {
  const low = warehouses.filter((w) => w.status === "shortage");
  const over = warehouses.filter((w) => w.status === "overstock");

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Stock alerts</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <AlertTile
          title="Low stock"
          count={low.length}
          tone="rose"
          items={low}
        />
        <AlertTile
          title="Overstock"
          count={over.length}
          tone="emerald"
          items={over}
        />
      </div>
      {low.length + over.length === 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400 text-center">
          No stock alerts right now.
        </div>
      )}
    </div>
  );
}

function AlertTile({
  title,
  count,
  tone,
  items,
}: {
  title: string;
  count: number;
  tone: "rose" | "emerald";
  items: WarehouseSummary[];
}) {
  const toneClasses =
    tone === "rose"
      ? { bg: "bg-rose-900/60", ring: "ring-rose-500/60", text: "text-rose-100" }
      : { bg: "bg-emerald-900/60", ring: "ring-emerald-500/60", text: "text-emerald-100" };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <div className="flex items-center justify-between">
        <p className="text-[0.7rem] font-semibold text-slate-200">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ${toneClasses.ring} ${toneClasses.bg} ${toneClasses.text}`}>
          {count}
        </span>
      </div>
      {items.length > 0 && (
        <div className="mt-2 space-y-1">
          {items.slice(0, 3).map((w) => (
            <div key={w.name} className="rounded bg-slate-950/30 px-2 py-1 text-[0.65rem]">
              <p className="text-slate-200">{w.name}</p>
              <p className="text-slate-500">
                Stock: {w.stock_level} · Reorder: {w.reorder_point}
              </p>
            </div>
          ))}
          {items.length > 3 && <p className="text-[0.65rem] text-slate-500">+{items.length - 3} more</p>}
        </div>
      )}
    </div>
  );
}

