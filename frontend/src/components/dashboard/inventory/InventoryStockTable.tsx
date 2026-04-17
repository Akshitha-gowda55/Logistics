type WarehouseSummary = {
  name: string;
  region: string;
  stock_level: number;
  avg_daily_demand: number;
  projected_daily_demand: number;
  lead_time_days: number;
  safety_stock: number;
  reorder_point: number;
  shortage_qty: number;
  excess_qty: number;
  status: "normal" | "shortage" | "overstock" | string;
};

export function InventoryStockTable({ warehouses }: { warehouses: WarehouseSummary[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Warehouse Stock Table</p>
      <div className="mt-3 overflow-auto rounded-lg border border-slate-800">
        <table className="min-w-[860px] w-full border-collapse">
          <thead className="bg-slate-900/70">
            <tr className="text-left text-[0.7rem] text-slate-300">
              <th className="p-3 font-semibold">Warehouse</th>
              <th className="p-3 font-semibold">Area</th>
              <th className="p-3 font-semibold">Stock</th>
              <th className="p-3 font-semibold">Daily Demand</th>
              <th className="p-3 font-semibold">Predicted</th>
              <th className="p-3 font-semibold">Lead Time</th>
              <th className="p-3 font-semibold">Safety</th>
              <th className="p-3 font-semibold">Reorder</th>
              <th className="p-3 font-semibold">Difference</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((warehouse) => (
              <tr key={warehouse.name} className="border-t border-slate-800 text-[0.75rem] text-slate-200">
                <td className="p-3 font-medium text-slate-100">{warehouse.name}</td>
                <td className="p-3">{warehouse.region}</td>
                <td className="p-3">{warehouse.stock_level}</td>
                <td className="p-3">{warehouse.avg_daily_demand}</td>
                <td className="p-3 font-semibold text-sky-200">{warehouse.projected_daily_demand}</td>
                <td className="p-3">{warehouse.lead_time_days}d</td>
                <td className="p-3">{warehouse.safety_stock}</td>
                <td className="p-3">{warehouse.reorder_point}</td>
                <td className="p-3">
                  {warehouse.status === "shortage" ? `-${warehouse.shortage_qty}` : warehouse.status === "overstock" ? `+${warehouse.excess_qty}` : "OK"}
                </td>
                <td className="p-3">
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[0.65rem]">
                    {warehouse.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

