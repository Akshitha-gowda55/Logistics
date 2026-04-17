import type { WorkflowUpdate } from "../../lib/api";

export function RemarkHistory({ timeline }: { timeline: WorkflowUpdate[] }) {
  const remarks = timeline
    .filter((t) => (t.remark ?? "").trim().length > 0)
    .slice()
    .reverse();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-semibold text-slate-100">Note History</p>
      <p className="mt-1 text-xs text-slate-400">Notes saved during step updates.</p>
      {remarks.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-500 text-center">
          No notes yet.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {remarks.slice(0, 12).map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <p className="text-xs font-semibold text-slate-200">
                {t.stage_name} · {t.role} · {new Date(t.created_at).toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-slate-100">{t.remark}</p>
              <p className="mt-1 text-[0.7rem] text-slate-500">
                {t.previous_status} {"->"} {t.new_status}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

