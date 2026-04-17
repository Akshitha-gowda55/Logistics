import type { AuditLogItem } from "../../lib/api";

export function AuditPreviewPanel({ items }: { items: AuditLogItem[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-semibold text-slate-100">History Preview</p>
      <p className="mt-1 text-xs text-slate-400">Recent actions for this work item.</p>
      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-500 text-center">
          No history items found.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.slice(0, 10).map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <p className="text-xs font-semibold text-slate-200">
                {a.action_type} · <span className="text-slate-400">{a.module_name}</span>
              </p>
              <p className="mt-1 text-sm text-slate-100">{a.details}</p>
              <p className="mt-1 text-[0.7rem] text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

