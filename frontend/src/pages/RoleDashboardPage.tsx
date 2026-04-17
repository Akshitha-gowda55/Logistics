import { useCallback, useEffect, useState } from "react";
import { api, DashboardSummaryResponse, UserRole, Workflow } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { InventoryDashboardPage } from "./InventoryDashboardPage";
import { SupplierRiskDashboardPage } from "./SupplierRiskDashboardPage";
import { ExecutiveDemandPanel } from "../components/dashboard/exec/ExecutiveDemandPanel";
import { ExecutiveInventorySummary } from "../components/dashboard/inventory/ExecutiveInventorySummary";
import { ExecutiveSupplierRiskSummary } from "../components/dashboard/supplier-risk/ExecutiveSupplierRiskSummary";
import { ScenarioSimulationPanel } from "../components/dashboard/exec/ScenarioSimulationPanel";
import { WorkflowStageChecklist } from "../components/workflow/WorkflowStageChecklist";
import { ExecutiveWorkflowOverview } from "../components/dashboard/exec/ExecutiveWorkflowOverview";
import { useWorkflowSyncRefresh } from "../hooks/useWorkflowSync";

export function RoleDashboardPage({ role }: { role: UserRole }) {
  const { token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [tasks, setTasks] = useState<Workflow[]>([]);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);
  const [insights, setInsights] = useState<any | null>(null);
  const [inventoryInsights, setInventoryInsights] = useState<any | null>(null);
  const [supplierRisk, setSupplierRisk] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [sum, pending] = await Promise.all([api.dashboardSummaryByRole(token, role), api.pendingTasks(token)]);
      setSummary(sum);
      setTasks(pending);
      if (role === "executive") {
        const [inv, risk, forecast, wfList] = await Promise.all([
          api.inventoryInsights(token),
          api.supplierRisk(token),
          api.forecast(token),
          api.workflows(token),
        ]);
        setInventoryInsights(inv);
        setSupplierRisk(risk);
        setInsights(forecast);
        setAllWorkflows(wfList);
      } else {
        setAllWorkflows([]);
        if (role === "operations") {
          setInsights(await api.routeRecommendations(token, "Hyderabad", "Pune"));
        } else if (role === "inventory") {
          setInsights(await api.inventoryInsights(token));
        } else {
          setInsights(await api.supplierRisk(token));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useWorkflowSyncRefresh(loadDashboard, [token, role]);

  if (role === "inventory") {
    return <InventoryDashboardPage />;
  }

  if (role === "supplier_risk") {
    return <SupplierRiskDashboardPage />;
  }

  if (loading || !summary) return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-slate-300">Loading dashboard…</div>;
  if (error) return <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-rose-100">{error}</div>;

  return (
    <div className="space-y-5">
      {role === "executive" ? <ExecutiveWorkflowOverview workflows={allWorkflows} /> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Active Work" value={summary.summary.active_workflows.toString()} />
        <Card title="On-Time Delivery" value={`${summary.summary.on_time_delivery_pct}%`} />
        <Card title="Delayed Items" value={summary.summary.delayed_workflows.toString()} />
        <Card title="Done Rate" value={`${summary.summary.workflow_completion_rate}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr,1.2fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-lg font-semibold text-white">Tasks to Do</h2>
          <p className="mt-1 text-xs text-slate-400">These tasks are for your role.</p>
          <div className="mt-3 space-y-2">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                No tasks for this role right now.
              </div>
            ) : tasks.map((task) => (
              <div
                key={task.workflow_id}
                className="rounded-lg border border-slate-700 p-3 hover:border-sky-600/60 hover:bg-slate-800/60"
              >
                <Link to={`/workflows/${task.workflow_id}`} className="block">
                  <p className="text-sm font-semibold text-slate-100">
                    {task.workflow_id} · {task.shipment_id}
                  </p>
                  <p className="text-sm text-slate-400 line-clamp-1">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    Step: {task.current_stage} · Status: {task.status} · Progress: {task.progress_percent}%
                  </p>
                </Link>
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <WorkflowStageChecklist
                    compact
                    workflowId={task.workflow_id}
                    showMarkComplete={false}
                    onWorkflowUpdated={() => void loadDashboard()}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          {role === "executive" ? (
            <div className="space-y-4">
              <ExecutiveDemandPanel forecast={insights} />
              <ExecutiveInventorySummary insights={inventoryInsights} />
              <ExecutiveSupplierRiskSummary risk={supplierRisk} />
              <ScenarioSimulationPanel />
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">Quick Help</h2>
              <p className="mt-1 text-xs text-slate-400">Simple route and risk info for your tasks.</p>
              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Best Route Tip</p>
                <p className="mt-2 text-sm text-slate-200">
                  {insights?.best_route
                    ? `Best route is ${insights.best_route.route_code}. ETA is ${insights.best_route.eta_hours?.toFixed?.(1) ?? insights.best_route.eta_hours}h. Reliability is ${Math.round((insights.best_route.reliability ?? 0) * 100)}%.`
                    : "Best route info will show here."}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Recent Updates</p>
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Open Alerts to see all updates.
                </p>
                <Link
                  to="/notifications"
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-sky-600 px-3 py-1.5 text-[0.7rem] font-semibold text-white hover:bg-sky-500"
                >
                  Open Alerts
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
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
