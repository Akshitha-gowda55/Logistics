import type { IndiaCityWire, RouteMode, RouteRecommendationRequest } from "../../lib/api";
import type { IndiaCityRef } from "../../lib/indiaCitiesLookup";

function nowPlusHoursIso(hours: number) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toISOString();
}

export function RouteSearchForm({
  value,
  onChange,
  onSubmit,
  working,
  indiaCities,
}: {
  value: RouteRecommendationRequest;
  onChange: (next: RouteRecommendationRequest) => void;
  onSubmit: () => void;
  working: boolean;
  indiaCities: IndiaCityWire[];
}) {
  const list: IndiaCityRef[] = indiaCities.map((c) => ({
    id: c.id,
    display_name: c.display_name,
    state: c.state,
    latitude: c.latitude,
    longitude: c.longitude,
    region: c.region,
    hub_type: c.hub_type,
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-sm font-semibold text-slate-100">Find Route</p>
      <p className="mt-1 text-xs text-slate-400">Pick any Indian city or hub from suggestions, or type a known city name.</p>

      <div className="mt-3 grid gap-2">
        <datalist id="india-cities-datalist">
          {list.map((c) => (
            <option key={c.id} value={c.display_name}>
              {c.state} · {c.hub_type}
            </option>
          ))}
        </datalist>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="From"
            value={value.source_location}
            onChange={(v) => onChange({ ...value, source_location: v })}
            placeholder="e.g. Bengaluru"
            listId="india-cities-datalist"
          />
          <Input
            label="To"
            value={value.destination_location}
            onChange={(v) => onChange({ ...value, destination_location: v })}
            placeholder="e.g. Delhi"
            listId="india-cities-datalist"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Amount"
            value={String(value.shipment_quantity)}
            onChange={(v) => onChange({ ...value, shipment_quantity: Number(v || 1) })}
            placeholder="800"
          />
          <Select
            label="Priority"
            value={value.priority}
            onChange={(v) => onChange({ ...value, priority: v as any })}
            options={["Low", "Medium", "High", "Critical"]}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Shipment type" value={value.shipment_type} onChange={(v) => onChange({ ...value, shipment_type: v })} placeholder="electronics" />
          <Select
            label="Travel mode"
            value={value.preferred_mode ?? ""}
            onChange={(v) => onChange({ ...value, preferred_mode: (v ? (v as RouteMode) : null) })}
            options={["", "road", "rail", "air", "sea", "multimodal"]}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Arrival time (ISO)"
            value={value.delivery_deadline ?? ""}
            onChange={(v) => onChange({ ...value, delivery_deadline: v || null })}
            placeholder={nowPlusHoursIso(30)}
          />
          <Input
            label="Blocked carriers (comma-separated)"
            value={(value.carrier_constraints ?? []).join(", ")}
            onChange={(v) =>
              onChange({ ...value, carrier_constraints: v.split(",").map((x) => x.trim()).filter(Boolean) })
            }
            placeholder="ShieldHaul Premium"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Slider
            label="Cost weight"
            value={value.cost_preference ?? 0.5}
            onChange={(v) => onChange({ ...value, cost_preference: v })}
          />
          <Slider
            label="CO2 weight"
            value={value.co2_preference ?? 0.5}
            onChange={(v) => onChange({ ...value, co2_preference: v })}
          />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={working}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {working ? "Finding…" : "Find Best Route"}
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  listId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  listId?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.7rem] text-slate-400">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500/60"
        value={value}
        placeholder={placeholder}
        list={listId}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[0.7rem] text-slate-400">{label}</span>
      <select
        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "" ? "Any" : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[0.7rem] text-slate-400">
        {label}: <span className="font-mono text-slate-200">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
    </label>
  );
}

