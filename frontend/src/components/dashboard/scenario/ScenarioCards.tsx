export type ScenarioId =
  | "supplier_delay"
  | "warehouse_shutdown"
  | "route_blockage"
  | "port_closure"
  | "demand_spike"
  | "regional_disruption";

const scenarios: Array<{ id: ScenarioId; title: string; desc: string; tone: string }> = [
  { id: "supplier_delay", title: "Supplier Delay", desc: "Supplier sends items late.", tone: "border-amber-500/50" },
  { id: "warehouse_shutdown", title: "Warehouse Closed", desc: "Warehouse stops work.", tone: "border-rose-500/50" },
  { id: "route_blockage", title: "Route Blocked", desc: "Road or rail is blocked.", tone: "border-slate-700" },
  { id: "port_closure", title: "Port Closed", desc: "Port is closed or very slow.", tone: "border-red-500/50" },
  { id: "demand_spike", title: "Demand Jump", desc: "Customer demand suddenly goes up.", tone: "border-sky-500/50" },
  { id: "regional_disruption", title: "Region Problem", desc: "A region has weather or local issues.", tone: "border-violet-500/50" },
];

export function ScenarioCards({ selected, onSelect }: { selected: ScenarioId; onSelect: (id: ScenarioId) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {scenarios.map((s) => {
        const active = selected === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={[
              "rounded-xl border p-3 text-left transition",
              active ? "border-sky-500 bg-sky-950/30" : `bg-slate-950/40 hover:bg-slate-900/60 ${s.tone}`,
            ].join(" ")}
          >
            <p className="text-sm font-semibold text-slate-100">{s.title}</p>
            <p className="mt-1 text-[0.72rem] text-slate-400">{s.desc}</p>
          </button>
        );
      })}
    </div>
  );
}

