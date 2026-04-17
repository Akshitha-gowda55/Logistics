import { shipmentRows, type ShipmentRow } from "../../data/dashboardDummy";

function statusLabel(s: ShipmentRow["status"]) {
  if (s === "on_track") return "On track";
  if (s === "at_risk") return "At risk";
  return "Delayed";
}

function statusPill(s: ShipmentRow["status"]) {
  if (s === "on_track") return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25";
  if (s === "at_risk") return "bg-amber-500/15 text-amber-100 ring-amber-500/25";
  return "bg-rose-500/15 text-rose-100 ring-rose-500/30";
}

export function ShipmentTracking() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="pb-2 pr-3">Shipment</th>
            <th className="pb-2 pr-3">Lane</th>
            <th className="pb-2 pr-3">Mode</th>
            <th className="pb-2 pr-3">ETA</th>
            <th className="pb-2 pr-3">Progress</th>
            <th className="pb-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {shipmentRows.map((row) => (
            <tr key={row.id} className="text-slate-200">
              <td className="py-2.5 pr-3 font-mono text-xs text-slate-300">{row.id}</td>
              <td className="py-2.5 pr-3 text-slate-300">{row.lane}</td>
              <td className="py-2.5 pr-3 text-slate-400">{row.mode}</td>
              <td className="py-2.5 pr-3 text-slate-400">{row.eta}</td>
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 min-w-[72px] max-w-[140px] overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-400"
                      style={{ width: `${row.progress}%`, background: row.status === "delayed" ? "#f87171" : "#94a3b8" }}
                    />
                  </div>
                  <span className="tabular-nums text-xs text-slate-500">{row.progress}%</span>
                </div>
              </td>
              <td className="py-2.5 text-right">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${statusPill(row.status)}`}>
                  {statusLabel(row.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
