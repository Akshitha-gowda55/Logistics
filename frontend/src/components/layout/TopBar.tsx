import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { emitWorkflowSync } from "../../hooks/useWorkflowSync";
import { drainOfflineQueue, OFFLINE_QUEUE_CHANGED_EVENT, readQueue } from "../../lib/offlineQueue";
import { NotificationBell } from "../ui/NotificationBell";

const titles: Record<string, string> = {
  "/dashboard/executive": "Executive dashboard",
  "/dashboard/operations": "Operations dashboard",
  "/dashboard/inventory": "Warehouse dashboard",
  "/dashboard/supplier-risk": "Supplier dashboard",
};

export function TopBar() {
  const loc = useLocation();
  const { user, logout, token } = useAuth();
  const title = titles[loc.pathname] ?? "Dashboard";
  const [online, setOnline] = useState(() => typeof navigator !== "undefined" && navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => readQueue().length);
  const [syncHint, setSyncHint] = useState<string | null>(null);

  useEffect(() => {
    const refreshCount = () => setPendingCount(readQueue().length);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshCount);
    const onOff = () => setOnline(false);
    const onOn = () => setOnline(true);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshCount);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!online || !token) return;
      const { syncedTotal, failedReason, remaining } = await drainOfflineQueue(token);
      if (cancelled) return;
      if (syncedTotal > 0) {
        emitWorkflowSync();
        setSyncHint("Synced successfully");
        window.setTimeout(() => setSyncHint((h) => (h === "Synced successfully" ? null : h)), 4000);
      }
      if (failedReason) {
        setSyncHint(failedReason);
      }
      setPendingCount(remaining);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [online, token, pendingCount]);

  /** After a failed sync, retry every 30s while online and the queue is non-empty. */
  useEffect(() => {
    if (!online || !token) return;
    const id = window.setInterval(() => {
      if (readQueue().length === 0) return;
      void (async () => {
        const { syncedTotal, failedReason, remaining } = await drainOfflineQueue(token);
        setPendingCount(remaining);
        if (syncedTotal > 0) {
          emitWorkflowSync();
          setSyncHint("Synced successfully");
          window.setTimeout(() => setSyncHint((h) => (h === "Synced successfully" ? null : h)), 4000);
        }
        if (failedReason) {
          setSyncHint(failedReason);
        }
      })();
    }, 30000);
    return () => window.clearInterval(id);
  }, [online, token]);

  return (
    <header className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950/70 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Supply chain overview</p>
          <h1 className="font-display text-xl font-semibold text-white">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NotificationBell />
          <button onClick={logout} className="rounded-lg bg-rose-900/50 px-3 py-1.5 text-sm font-medium text-rose-100 hover:bg-rose-800/60">
            Log Out
          </button>
          <span className="hidden rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400 sm:inline">
            {user?.name} · {user?.role}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!online ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 text-amber-100">
            Offline mode: changes saved locally
          </span>
        ) : pendingCount > 0 ? (
          <span className="rounded-full border border-sky-500/40 bg-sky-950/30 px-2 py-0.5 text-sky-100">
            Pending sync: {pendingCount} {pendingCount === 1 ? "change" : "changes"}
          </span>
        ) : null}
        {syncHint ? (
          <span
            className={`rounded-full px-2 py-0.5 ${
              syncHint === "Synced successfully"
                ? "border border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                : "border border-rose-500/40 bg-rose-950/30 text-rose-100"
            }`}
          >
            {syncHint}
          </span>
        ) : null}
      </div>
    </header>
  );
}
