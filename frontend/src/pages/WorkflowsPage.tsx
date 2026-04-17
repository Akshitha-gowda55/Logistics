import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, Workflow } from "../lib/api";

export function WorkflowsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    api.workflows(token).then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Failed to load workflows")).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-xl font-semibold text-white">Work Tracker</h2>
      <p className="mt-1 text-xs text-slate-400">See who owns each work item and how far it is done.</p>
      {error ? <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-100">{error}</div> : null}
      <div className="mt-3 overflow-x-auto">
        {loading ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">Loading work items…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
            No work items yet. Start one from the executive page.
          </div>
        ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2">Work ID</th>
              <th>Shipment</th>
              <th>Current Step</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.workflow_id} className="border-t border-slate-800 text-slate-100">
                <td className="py-2">
                  <Link className="text-cyan-300 hover:underline" to={`/workflows/${w.workflow_id}`}>
                    {w.workflow_id}
                  </Link>
                </td>
                <td>{w.shipment_id}</td>
                <td>{w.current_stage}</td>
                <td>{w.status}</td>
                <td>{w.current_role}</td>
                <td>{w.progress_percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
