import { useCallback, useEffect, useMemo, useState } from "react";
import type { TimelineEntryWire, Workflow } from "../../lib/api";
import { api } from "../../lib/api";
import { useWorkflowSyncRefresh } from "../../hooks/useWorkflowSync";
import { RawMaterialEntryForm } from "./RawMaterialEntryForm";

function badgeClass(status: Workflow["status"]): string {
  if (status === "Delayed") return "border-amber-500/50 bg-amber-950/30 text-amber-100";
  if (status === "Completed" || status === "Closed") return "border-emerald-500/40 bg-emerald-950/20 text-emerald-100";
  return "border-sky-500/40 bg-sky-950/20 text-sky-100";
}

export function ExecutiveSimpleDashboard({ token }: { token: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.workflows(token);
      setWorkflows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load work items.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => void load(), [load]);
  useWorkflowSyncRefresh(load, [token], 4500);

  const stats = useMemo(() => {
    const active = workflows.filter((w) => w.status !== "Closed" && w.current_stage !== "closed");
    return {
      total: workflows.length,
      pendingSupplier: active.filter((w) => w.current_stage === "supplier_risk").length,
      pendingOps: active.filter((w) => w.current_stage === "operations").length,
      pendingWh: active.filter((w) => w.current_stage === "inventory").length,
      completed: workflows.filter((w) => w.status === "Completed" || w.status === "Closed" || w.current_stage === "closed").length,
    };
  }, [workflows]);

  const mergedTimeline: (TimelineEntryWire & { item_name?: string })[] = useMemo(() => {
    const rows: (TimelineEntryWire & { item_name?: string })[] = [];
    for (const w of workflows) {
      for (const t of w.timeline ?? []) {
        rows.push({ ...t, item_name: w.item_name });
      }
    }
    rows.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
    return rows.slice(0, 35);
  }, [workflows]);

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border px-4 py-2 text-sm ${online ? "border-slate-700 text-slate-400" : "border-amber-600/60 text-amber-100"}`}>
        {online ? "Online — dashboards refresh every few seconds." : "Offline mode: saves new requests locally until you reconnect."}
      </div>

      {!online ? (
        <p className="text-xs text-amber-200/90">
          Teams can queue checklist changes offline; when you reconnect, the top bar drains the queue and dashboards refresh.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          ["Total items", stats.total.toString()],
          ["Waiting on supplier", stats.pendingSupplier.toString()],
          ["Waiting on operations", stats.pendingOps.toString()],
          ["Waiting on warehouse", stats.pendingWh.toString()],
          ["Finished", stats.completed.toString()],
        ].map(([label, val]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="text-[0.7rem] text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{val}</p>
          </div>
        ))}
      </div>

      <RawMaterialEntryForm token={token} onCreated={() => void load()} />

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">All teams · work overview</h2>
        <p className="mt-1 text-xs text-slate-400">
          Executive sees every row. Supplier, Operations, and Warehouse edit their checklist from the shipment list (quick section) or full
          checklist page — not on this table.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : workflows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No shipments yet. Add one with the form above.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-[0.65rem] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3">Operations</th>
                  <th className="py-2 pr-3">Warehouse</th>
                  <th className="py-2 pr-3">Current team</th>
                  <th className="py-2 pr-3">Priority</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/80">
                    <td className="py-2 pr-3 font-medium text-slate-100">{w.item_name}</td>
                    <td className="py-2 pr-3">
                      {w.quantity != null ? `${w.quantity} ${w.unit || ""}` : "—"}
                    </td>
                    <td className="py-2 pr-3">{w.supplier_completed ? "Done" : "Open"}</td>
                    <td className="py-2 pr-3">{w.operations_completed ? "Done" : "Open"}</td>
                    <td className="py-2 pr-3">{w.inventory_completed ? "Done" : "Open"}</td>
                    <td className="py-2 pr-3 text-sky-200">{w.current_role.replace("_", " ")}</td>
                    <td className="py-2 pr-3">{w.priority}</td>
                    <td className="py-2 pr-3 text-slate-500">{new Date(w.updated_at).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] ring-1 ${badgeClass(w.status)}`}>{w.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">Latest updates</h2>
        <p className="mt-1 text-xs text-slate-400">
          Combined update history across your items (sync_status shows local vs synced when present).
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {mergedTimeline.length === 0 ? (
            <li className="text-slate-500">No updates yet.</li>
          ) : (
            mergedTimeline.map((ev, idx) => (
              <li key={`${ev.time}-${idx}`} className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
                <p className="text-slate-200">
                  {ev.item_name ? <span className="font-semibold text-white">{ev.item_name}: </span> : null}
                  {ev.action}
                </p>
                <p className="mt-1 text-[0.65rem] text-slate-500">
                  {ev.role} · {ev.time}
                  {ev.sync_status === "local_pending" ? " · offline pending" : ""}
                  {ev.remarks ? ` — ${ev.remarks}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
