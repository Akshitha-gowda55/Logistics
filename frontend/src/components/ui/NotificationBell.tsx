import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { WORKFLOW_SYNC_EVENT } from "../../hooks/useWorkflowSync";

export function NotificationBell() {
  const { token } = useAuth();
  const [unread, setUnread] = useState<number>(0);

  async function refresh() {
    if (!token) return;
    try {
      const { unread } = await api.unreadNotificationCount(token);
      setUnread(unread);
    } catch {
      // best-effort; keep silent in UI
    }
  }

  useEffect(() => {
    void refresh();
    if (!token) return;
    const onWorkflowSync = () => void refresh();
    window.addEventListener(WORKFLOW_SYNC_EVENT, onWorkflowSync);
    const id = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => {
      window.removeEventListener(WORKFLOW_SYNC_EVENT, onWorkflowSync);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Link to="/notifications" className="relative inline-flex items-center justify-center rounded-lg bg-slate-800 px-3 py-1.5 text-slate-100 hover:bg-slate-700">
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
    </Link>
  );
}

