import { useCallback, useEffect, useState } from "react";
import { api, DashboardSummaryResponse, UserRole, Workflow } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ExecutiveSimpleDashboard } from "../components/dashboard/ExecutiveSimpleDashboard";
import { SmartAlertsBanner } from "../components/dashboard/SmartAlertsBanner";
import { ShipmentProgressTasksPanel } from "../components/dashboard/ShipmentProgressTasksPanel";
import { TeamWorkloadPage } from "./TeamWorkloadPage";
import { useWorkflowSyncRefresh } from "../hooks/useWorkflowSync";

/** Operations Control Tower — map-heavy tools removed for the simple ladder (Supplier → Ops → Warehouse). */
export function RoleDashboardPage({ role }: { role: UserRole }) {
  const { token, user } = useAuth();
  const myRole = user?.role ?? role;

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [sum, allWf] = await Promise.all([api.dashboardSummaryByRole(token, role), api.workflows(token)]);
      setSummary(sum);
      setAllWorkflows(allWf);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => void loadDashboard(), [loadDashboard]);
  useWorkflowSyncRefresh(loadDashboard, [token, role], 2800);

  if (!token) return null;

  if (role === "executive") {
    return <ExecutiveSimpleDashboard token={token} />;
  }

  if (role === "inventory") {
    return <TeamWorkloadPage token={token} role="inventory" />;
  }

  if (role === "supplier_risk") {
    return <TeamWorkloadPage token={token} role="supplier_risk" />;
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-slate-300">Loading…</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-rose-100">{error}</div>;
  }
  if (!summary) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-amber-100">
        Cannot load this page. Check sign-in and API, then refresh.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SmartAlertsBanner delayedCount={summary.summary.delayed_workflows} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Active work items" value={summary.summary.active_workflows.toString()} />
        <Card title="On time %" value={`${summary.summary.on_time_delivery_pct}%`} />
        <Card title="Late items" value={summary.summary.delayed_workflows.toString()} />
        <Card title="Done %" value={`${summary.summary.workflow_completion_rate}%`} />
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
        <h2 className="text-lg font-semibold text-white">Operations</h2>
        <p className="mt-1 text-xs text-slate-400">
          Move loads from supplier pickup through delivery to warehouse. Tick only Operations boxes on each shipment&apos;s page.
          Executive and Warehouse see updates as you go.
        </p>
      </section>

      <ShipmentProgressTasksPanel
        workflows={allWorkflows}
        currentRole={myRole}
        title="Shipments / work items"
        intro="Tap a shipment to update route and logistics checklists. Other dashboards refresh automatically."
      />
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
