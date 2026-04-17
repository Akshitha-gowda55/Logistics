type DisruptionAlert = {
  severity: string;
  title: string;
  probability: number;
  detail: string;
};

function severityClasses(severity: string): { ring: string; bg: string; text: string } {
  const s = severity.toLowerCase();
  if (s.includes("critical")) return { ring: "ring-red-500/70", bg: "bg-red-900/55", text: "text-red-100" };
  if (s.includes("high")) return { ring: "ring-rose-500/60", bg: "bg-rose-900/50", text: "text-rose-100" };
  if (s.includes("medium")) return { ring: "ring-amber-500/60", bg: "bg-amber-900/45", text: "text-amber-100" };
  return { ring: "ring-emerald-500/60", bg: "bg-emerald-900/45", text: "text-emerald-100" };
}

export function DisruptionAlertsPanel({ alerts }: { alerts: DisruptionAlert[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Problem Alerts</p>

      {alerts.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-[0.7rem] text-slate-400 text-center">
          No problem alerts right now.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {alerts.map((a, idx) => {
            const c = severityClasses(a.severity);
            return (
              <div key={`${a.title}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-100">{a.title}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-400">{a.detail}</p>
                  </div>
                  <span className={["shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1", c.ring, c.bg, c.text].join(" ")}>
                    {(a.probability * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

