import { useMemo, useState } from "react";
import { heatmapLocations, heatmapSkus, inventoryHeatmapValues } from "../../data/dashboardDummy";

function coverTone(days: number): string {
  if (days >= 28) return "bg-emerald-500/85 text-slate-950";
  if (days >= 18) return "bg-emerald-600/50 text-emerald-50";
  if (days >= 12) return "bg-amber-500/45 text-amber-950";
  return "bg-rose-500/70 text-rose-50";
}

export function InventoryHeatmap() {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const label = useMemo(() => {
    if (!hover) return "Days of cover by SKU and location";
    const d = inventoryHeatmapValues[hover.r]?.[hover.c];
    if (d === undefined) return "";
    return `${heatmapSkus[hover.r]} @ ${heatmapLocations[hover.c]} — ${d} days`;
  }, [hover]);

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">{label}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-left text-xs">
          <thead>
            <tr>
              <th className="rounded-md bg-slate-950/80 px-2 py-2 font-medium text-slate-500">SKU</th>
              {heatmapLocations.map((loc) => (
                <th
                  key={loc}
                  className="rounded-md bg-slate-950/80 px-2 py-2 text-center font-medium text-slate-400"
                >
                  {loc}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapSkus.map((sku, r) => (
              <tr key={sku}>
                <td className="whitespace-nowrap rounded-md bg-slate-950/60 px-2 py-1.5 font-mono text-slate-300">
                  {sku}
                </td>
                {heatmapLocations.map((_, c) => {
                  const v = inventoryHeatmapValues[r][c];
                  const active = hover?.r === r && hover?.c === c;
                  return (
                    <td key={`${r}-${c}`} className="p-0">
                      <button
                        type="button"
                        onMouseEnter={() => setHover({ r, c })}
                        onMouseLeave={() => setHover(null)}
                        className={[
                          "flex h-10 w-full items-center justify-center rounded-md font-medium tabular-nums transition ring-0",
                          coverTone(v),
                          active ? "ring-2 ring-white/30" : "",
                        ].join(" ")}
                      >
                        {v}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded bg-rose-500/70" /> Low cover
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded bg-amber-500/45" /> Watch
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded bg-emerald-600/50" /> Healthy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded bg-emerald-500/85" /> High buffer
        </span>
      </div>
    </div>
  );
}
