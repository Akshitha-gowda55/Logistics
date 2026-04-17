import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type AuditTrailItem, type AuditTrailQuery, type UserRole } from "../lib/api";

function roleLabel(role: UserRole) {
  switch (role) {
    case "executive":
      return "Executive";
    case "operations":
      return "Operations";
    case "inventory":
      return "Inventory";
    case "supplier_risk":
      return "Supplier Risk";
  }
}

function rolePill(role: string | null) {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
  if (!role) return `${base} border-slate-700 text-slate-300`;
  if (role === "executive") return `${base} border-indigo-500/40 bg-indigo-500/10 text-indigo-200`;
  if (role === "operations") return `${base} border-cyan-500/40 bg-cyan-500/10 text-cyan-200`;
  if (role === "inventory") return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`;
  if (role === "supplier_risk") return `${base} border-amber-500/40 bg-amber-500/10 text-amber-200`;
  return `${base} border-slate-700 text-slate-300`;
}

function statusPill(text: string | null, kind: "prev" | "next") {
  const base = "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium";
  if (!text) return `${base} border-slate-800 text-slate-500`;
  if (kind === "prev") return `${base} border-slate-700 bg-slate-800/40 text-slate-200`;
  if (text === "Delayed") return `${base} border-amber-500/40 bg-amber-500/10 text-amber-200`;
  if (text === "Escalated") return `${base} border-rose-500/40 bg-rose-500/10 text-rose-200`;
  if (text === "Completed" || text === "Closed") return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`;
  if (text === "In Progress") return `${base} border-cyan-500/40 bg-cyan-500/10 text-cyan-200`;
  return `${base} border-slate-700 bg-slate-800/30 text-slate-200`;
}

function toIsoStartOfDay(date: string) {
  // date is YYYY-MM-DD
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function toIsoEndOfDay(date: string) {
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}

export function AuditTrailPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AuditTrailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<UserRole | "all">("all");
  const [workflowId, setWorkflowId] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const query = useMemo<AuditTrailQuery>(() => {
    const q: AuditTrailQuery = { limit: 250 };
    if (role !== "all") q.role = role;
    if (workflowId.trim()) q.workflow_id = workflowId.trim();
    if (startDate) q.start = toIsoStartOfDay(startDate);
    if (endDate) q.end = toIsoEndOfDay(endDate);
    return q;
  }, [role, workflowId, startDate, endDate]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .auditTrail(token, query)
      .then((res) => {
        if (!cancelled) setRows(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, query]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Activity History</h2>
            <p className="mt-1 text-sm text-slate-400">Find and filter actions in the app.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRole("all");
                setWorkflowId("");
                setStartDate("");
                setEndDate("");
              }}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="block">
            <div className="text-xs font-medium text-slate-400">Role</div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole | "all")}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-700"
            >
              <option value="all">All Roles</option>
              <option value="executive">{roleLabel("executive")}</option>
              <option value="operations">{roleLabel("operations")}</option>
              <option value="inventory">{roleLabel("inventory")}</option>
              <option value="supplier_risk">{roleLabel("supplier_risk")}</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-400">Workflow ID</div>
            <input
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="WF-102"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-slate-700"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-400">From Date</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-700"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-400">To Date</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-700"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="text-sm font-medium text-slate-100">Activity List</div>
          <div className="text-xs text-slate-500">
            {loading ? "Loading…" : `${rows.length} item${rows.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {error ? (
          <div className="px-4 py-4 text-sm text-rose-200">{error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">Loading history…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">No items match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Workflow</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Status Change</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-950/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-200">{a.user_name ?? `User #${a.user_id}`}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={rolePill(a.user_role)}>{a.user_role ? roleLabel(a.user_role as UserRole) : "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-200">{a.workflow_id ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{a.action_type}</div>
                      <div className="text-xs text-slate-500">{a.module_name}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={statusPill(a.previous_status, "prev")}>{a.previous_status ?? "—"}</span>
                        <span className="text-slate-600">→</span>
                        <span className={statusPill(a.new_status, "next")}>{a.new_status ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="line-clamp-2">{a.details}</div>
                      {a.remark ? <div className="mt-1 text-xs text-slate-500">Note: {a.remark}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
