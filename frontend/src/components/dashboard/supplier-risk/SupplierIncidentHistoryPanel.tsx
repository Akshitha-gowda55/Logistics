type SupplierIncident = {
  id: string;
  supplier: string;
  severity: string;
  time: string;
  headline: string;
  detail: string;
};

function severityTone(sev: string) {
  const s = sev.toLowerCase();
  if (s.includes("critical")) return "border-red-500/50 bg-red-950/30 text-red-100";
  if (s.includes("high")) return "border-rose-500/40 bg-rose-950/20 text-rose-100";
  if (s.includes("medium")) return "border-amber-500/40 bg-amber-950/20 text-amber-100";
  return "border-slate-800 bg-slate-950/40 text-slate-100";
}

export function SupplierIncidentHistoryPanel({ incidents }: { incidents: SupplierIncident[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier incident history</p>
      {incidents.length === 0 ? (
        <div className="mt-3 rounded border border-dashed border-slate-800 bg-slate-950/30 p-3 text-[0.7rem] text-slate-500">
          No supplier incidents detected in the current observation window.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {incidents.slice(0, 6).map((i) => (
            <div key={i.id} className={`rounded border p-2 ${severityTone(i.severity)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-semibold text-slate-100">{i.headline}</p>
                  <p className="mt-1 text-[0.7rem] text-slate-200/90">{i.detail}</p>
                  <p className="mt-1 text-[0.65rem] text-slate-400">{i.supplier}</p>
                </div>
                <p className="shrink-0 text-[0.65rem] text-slate-400">{i.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

