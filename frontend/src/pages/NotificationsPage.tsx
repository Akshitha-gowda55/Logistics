import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, NotificationItem } from "../lib/api";

export function NotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "handoff" | "warning" | "critical">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setItems(await api.notifications(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function markRead(id: number) {
    if (!token) return;
    await api.markNotificationRead(token, id);
    await load();
  }

  async function markAll() {
    if (!token) return;
    await api.markAllNotificationsRead(token);
    await load();
  }

  const unread = items.filter((n) => !n.is_read).length;
  const recent = items.slice(0, 20);

  const filtered =
    filter === "all"
      ? items
      : filter === "handoff"
        ? items.filter((n) => n.type === "success" || n.type === "info")
        : filter === "warning"
          ? items.filter((n) => n.type === "warning")
          : items.filter((n) => n.type === "critical");

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Alerts</h2>
            <p className="mt-1 text-xs text-slate-400">See handoffs, delays, due dates, and problems.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              <span className="font-semibold text-emerald-300">{unread}</span> new
            </span>
            {items.length > 0 ? (
              <button
                onClick={markAll}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[0.7rem] font-semibold text-slate-100 hover:border-sky-500/70 hover:bg-slate-800"
              >
                Mark All Read
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem]">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="Handoffs" active={filter === "handoff"} onClick={() => setFilter("handoff")} />
          <FilterChip label="Warnings" active={filter === "warning"} onClick={() => setFilter("warning")} />
          <FilterChip label="Problems" active={filter === "critical"} onClick={() => setFilter("critical")} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1.3fr]">
          <div className="space-y-2">
            {loading ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-center text-sm text-slate-300">Loading alerts…</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
                No alerts here. Try another filter.
              </div>
            ) : (
              filtered.map((n) => (
                <AlertCard key={n.id} item={n} onMarkRead={() => markRead(n.id)} />
              ))
            )}
          </div>
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <h3 className="text-sm font-semibold text-white">Recent Updates</h3>
            <p className="mt-1 text-[0.7rem] text-slate-400">Latest alerts for your role.</p>
            <div className="mt-2 space-y-2">
              {recent.length === 0 ? (
                <p className="text-[0.7rem] text-slate-500">No recent updates.</p>
              ) : (
                recent.slice(0, 8).map((n) => (
                  <RecentActivityRow key={n.id} item={n} />
                ))
              )}
            </div>
          </div>
        </div>
        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      </section>
    </div>
  );
}

function AlertCard({ item, onMarkRead }: { item: NotificationItem; onMarkRead: () => void }) {
  const tone =
    item.type === "critical"
      ? "border-rose-500/60 bg-rose-950/40"
      : item.type === "warning"
        ? "border-amber-500/50 bg-amber-950/30"
        : item.type === "success"
          ? "border-emerald-500/40 bg-emerald-950/40"
          : "border-slate-700 bg-slate-950/40";

  return (
    <div className={`rounded-lg border p-3 ${tone} ${item.is_read ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">{item.message}</p>
          <p className="mt-1 text-[0.7rem] text-slate-400">
            {item.related_workflow_id} · {new Date(item.created_at).toLocaleString()}
          </p>
        </div>
        {!item.is_read ? (
          <button
            onClick={onMarkRead}
            className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-[0.7rem] font-semibold text-slate-100 hover:bg-slate-800"
          >
            Mark Read
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1",
        active ? "border-sky-500 bg-sky-600 text-[0.7rem] font-semibold text-white" : "border-slate-700 bg-slate-900 text-[0.7rem] text-slate-300",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function RecentActivityRow({ item }: { item: NotificationItem }) {
  return (
    <Link
      to={`/workflows/${item.related_workflow_id}`}
      className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-left hover:border-sky-600/60 hover:bg-slate-900/70"
    >
      <div className="min-w-0">
        <p className="text-[0.75rem] font-medium text-slate-100 line-clamp-1">{item.message}</p>
        <p className="mt-0.5 text-[0.65rem] text-slate-500">
          {item.related_workflow_id} · {new Date(item.created_at).toLocaleTimeString()}
        </p>
      </div>
      {!item.is_read ? <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" /> : null}
    </Link>
  );
}
