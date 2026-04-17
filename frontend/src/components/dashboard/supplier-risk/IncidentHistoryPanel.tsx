import type { WorkflowUpdate } from "../../../lib/api";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function IncidentHistoryPanel({ timeline }: { timeline: WorkflowUpdate[] | any[] }) {
  const events = (timeline ?? []).slice(0).reverse();

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Incident history</p>

      {events.length === 0 ? (
        <div className="mt-3 rounded border border-dashed border-slate-800 bg-slate-950/30 p-3 text-[0.7rem] text-slate-500">
          No incident history found for this case.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {events.slice(0, 8).map((ev: any, idx) => (
            <div key={`${ev.id ?? idx}-${idx}`} className="rounded border border-slate-800/60 bg-slate-950/40 p-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-semibold text-slate-100">
                    {ev.stage_name} · {ev.previous_status} → {ev.new_status}
                  </p>
                  {ev.remark ? <p className="mt-1 text-[0.7rem] text-slate-300">{ev.remark}</p> : null}
                  <p className="mt-1 text-[0.65rem] text-slate-500">Role: {ev.role}</p>
                </div>
                <p className="shrink-0 text-[0.65rem] text-slate-500">{formatTime(ev.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

