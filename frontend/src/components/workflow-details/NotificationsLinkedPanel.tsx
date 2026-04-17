import type { NotificationItem } from "../../lib/api";

function tone(type: NotificationItem["type"]) {
  if (type === "critical") return "border-rose-500/40 bg-rose-950/20";
  if (type === "warning") return "border-amber-500/40 bg-amber-950/20";
  if (type === "success") return "border-emerald-500/40 bg-emerald-950/20";
  return "border-slate-800 bg-slate-950/30";
}

export function NotificationsLinkedPanel({ items }: { items: NotificationItem[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-semibold text-slate-100">Linked Alerts</p>
      <p className="mt-1 text-xs text-slate-400">Alerts linked to this work item.</p>
      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-500 text-center">
          No linked alerts.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.slice(0, 10).map((n) => (
            <div key={n.id} className={`rounded-lg border p-3 ${tone(n.type)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200">{n.type.toUpperCase()}</p>
                  <p className="mt-1 text-sm text-slate-100">{n.message}</p>
                  <p className="mt-1 text-[0.7rem] text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.is_read ? <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" /> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

