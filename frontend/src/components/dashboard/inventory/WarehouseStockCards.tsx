type WarehouseSummary = {
  name: string;
  region: string;
  stock_level: number;
  projected_daily_demand?: number;
  safety_stock: number;
  reorder_point: number;
  shortage_qty: number;
  excess_qty: number;
  status: "normal" | "shortage" | "overstock" | string;
};

export function WarehouseStockCards({ warehouses }: { warehouses: WarehouseSummary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {warehouses.map((warehouse) => {
        const tone =
          warehouse.status === "shortage"
            ? "border-rose-500/40 bg-rose-950/20"
            : warehouse.status === "overstock"
              ? "border-emerald-500/40 bg-emerald-950/20"
              : "border-slate-800 bg-slate-950/40";

        return (
          <div key={warehouse.name} className={`rounded-xl border p-3 ${tone}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{warehouse.name}</p>
                <p className="mt-1 text-[0.7rem] text-slate-400">{warehouse.region} area</p>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[0.65rem] text-slate-200">
                {warehouse.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[0.7rem]">
              <Metric label="Stock" value={warehouse.stock_level} />
              <Metric label="Safety" value={warehouse.safety_stock} />
              <Metric label="Reorder" value={warehouse.reorder_point} />
            </div>
            {typeof warehouse.projected_daily_demand === "number" ? (
              <p className="mt-2 text-[0.7rem] text-slate-400">
                Predicted daily demand: <span className="font-semibold text-sky-200">{warehouse.projected_daily_demand}</span>
              </p>
            ) : null}
            {warehouse.status !== "normal" ? (
              <p className="mt-3 text-[0.7rem] text-slate-300">
                {warehouse.status === "shortage"
                  ? `Short by ${warehouse.shortage_qty} units vs reorder point.`
                  : `Extra stock: ${warehouse.excess_qty} units can be moved.`}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

