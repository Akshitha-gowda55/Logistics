import { useEffect, useRef, useState } from "react";
import { api, type NotificationItem } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { WORKFLOW_SYNC_EVENT } from "../../hooks/useWorkflowSync";

export function NotificationBell() {
  const { token } = useAuth();
  const [unread, setUnread] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  async function refreshCounts() {
    if (!token) return;
    try {
      const { unread } = await api.unreadNotificationCount(token);
      setUnread(unread);
    } catch {
      /* silent */
    }
  }

  async function loadList() {
    if (!token) return;
    try {
      const list = await api.notifications(token);
      setItems(Array.isArray(list) ? list.slice(0, 25) : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void refreshCounts();
    void loadList();
    const onWorkflowSync = () => {
      void refreshCounts();
      void loadList();
    };
    window.addEventListener(WORKFLOW_SYNC_EVENT, onWorkflowSync);
    const id = window.setInterval(refreshCounts, 30000);
    return () => {
      window.removeEventListener(WORKFLOW_SYNC_EVENT, onWorkflowSync);
      window.clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    if (!open) return;
    void loadList();
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, token]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="relative inline-flex items-center justify-center rounded-lg bg-slate-800 px-3 py-1.5 text-slate-100 hover:bg-slate-700"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative inline-flex items-center gap-1 text-sm font-medium">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Alerts
        </span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[0.65rem] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 max-h-[min(420px,calc(100vh-140px))] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-3 py-2">
            <p className="text-xs font-semibold text-slate-200">Alerts</p>
            {token ? (
              <button
                type="button"
                className="text-[0.7rem] font-medium text-sky-400 hover:text-sky-300"
                onClick={() =>
                  api.markAllNotificationsRead(token).then(() => {
                    void refreshCounts();
                    void loadList();
                  })
                }
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No alerts yet.</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {items.map((n) => (
                <li key={n.id} className="px-3 py-2 text-xs text-slate-300 hover:bg-slate-900/80">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-left">{n.message}</p>
                    {token ? (
                      <button
                        type="button"
                        className="shrink-0 text-[0.65rem] text-sky-400"
                        onClick={() =>
                          api.markNotificationRead(token, n.id).then(() => {
                            void refreshCounts();
                            void loadList();
                          })
                        }
                      >
                        ✓
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[0.65rem] text-slate-600">{new Date(n.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
