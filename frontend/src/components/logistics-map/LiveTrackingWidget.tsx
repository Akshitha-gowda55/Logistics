import { useEffect, useMemo, useState } from "react";
import type { LiveTrackingResponse } from "../../lib/api";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("delay")) return "border-rose-500/40 bg-rose-950/20 text-rose-100";
  if (s.includes("transit")) return "border-sky-500/40 bg-sky-950/20 text-sky-100";
  return "border-slate-800 bg-slate-950/40 text-slate-100";
}

export function LiveTrackingWidget({
  shipmentId,
  onTracking,
  /** When this value changes (e.g. selected route code), tracking is refetched so the marker matches the saved route. */
  syncKey,
}: {
  shipmentId: string;
  onTracking: (t: LiveTrackingResponse) => void;
  syncKey?: string;
}) {
  const { token } = useAuth();
  const [tracking, setTracking] = useState<LiveTrackingResponse | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function refresh() {
    if (!token || !shipmentId) return;
    setWorking(true);
    setError("");
    try {
      const t = await api.liveTracking(token, shipmentId);
      setTracking(t);
      onTracking(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tracking");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, shipmentId, syncKey]);

  useEffect(() => {
    if (!token || !shipmentId) return;
    const id = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, shipmentId]);

  const eta = useMemo(() => {
    if (!tracking?.eta) return "—";
    try {
      return new Date(tracking.eta).toLocaleString();
    } catch {
      return tracking.eta;
    }
  }, [tracking?.eta]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Live Tracking</p>
          <p className="mt-1 text-xs text-slate-400">See current shipment place and progress.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={working}
          className="rounded-full bg-emerald-700 px-3 py-1.5 text-[0.7rem] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {working ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-100">{error}</div> : null}

      {!tracking ? (
        <p className="mt-3 text-xs text-slate-400">Waiting for tracking data…</p>
      ) : (
        <>
          <div className={`mt-3 rounded-lg border p-3 text-xs ${statusTone(tracking.status)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-100">{tracking.shipment_id}</p>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[0.65rem] text-slate-200">
                {tracking.progress_percent}% done
              </span>
            </div>
            <p className="mt-1 text-slate-300">Status: {tracking.status}</p>
            <p className="mt-1 text-slate-300">Arrival time: {eta}</p>
          </div>

          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Checkpoint Progress</p>
            <div className="mt-2 space-y-2">
              {tracking.checkpoints.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/30 px-2 py-1.5 text-[0.72rem]">
                  <span className="text-slate-200">{c.name}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[0.65rem] text-slate-300">{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

