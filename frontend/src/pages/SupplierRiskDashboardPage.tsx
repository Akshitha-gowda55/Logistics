import { useCallback, useEffect, useMemo, useState } from "react";
import type { NotificationItem, Workflow, WorkflowStatus } from "../lib/api";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { SupplierCaseCard } from "../components/dashboard/supplier-risk/SupplierCaseCard";
import { IncidentHistoryPanel } from "../components/dashboard/supplier-risk/IncidentHistoryPanel";
import { DisruptionAlertsPanel } from "../components/dashboard/supplier-risk/DisruptionAlertsPanel";
import { SupplierComparisonTable } from "../components/dashboard/supplier-risk/SupplierComparisonTable";
import { MitigationActionPanel, type SupplierRiskActionKind } from "../components/dashboard/supplier-risk/MitigationActionPanel";
import { WorkflowStageStepper } from "../components/dashboard/inventory/WorkflowStageStepper";
import { RiskLevelBadge, riskLevelFromScore } from "../components/dashboard/supplier-risk/RiskLevelBadge";
import { SupplierScoreCards } from "../components/dashboard/supplier-risk/SupplierScoreCards";
import { SupplierRiskTrendChart } from "../components/dashboard/supplier-risk/SupplierRiskTrendChart";
import { SupplierIncidentHistoryPanel } from "../components/dashboard/supplier-risk/SupplierIncidentHistoryPanel";
import { formatScenarioLogisticsCostInr } from "../lib/formatCurrency";
import { WorkflowStageChecklist } from "../components/workflow/WorkflowStageChecklist";
import { useWorkflowSyncRefresh } from "../hooks/useWorkflowSync";

const supplierRiskStage = "supplier_risk";

type ScenarioResponse = {
  scenario: string;
  scenario_name: string;
  baseline: {
    logistics_cost_musd: number;
    eta_impact_hours: number;
    service_level_pct: number;
    inventory_shortage_units: number;
    supplier_risk_index: number;
  };
  after: {
    logistics_cost_musd: number;
    eta_impact_hours: number;
    service_level_pct: number;
    inventory_shortage_units: number;
    supplier_risk_index: number;
  };
  chart: Array<{ metric: string; baseline: number; after: number }>;
  playbook: string;
  recommended_actions: string[];
};

type SupplierRiskSupplier = {
  supplier: string;
  region: string;
  risk_score: number;
  risk_level: string;
  delay_probability: number;
  recommendation: string;
  trend?: Array<{ week: string; score: number }>;
};

type SupplierRiskInsightsResponse = {
  suppliers: SupplierRiskSupplier[];
  recommended_mitigation: string;
  alternate_supplier?: { supplier: string; reason: string } | null;
  incidents?: Array<{ id: string; supplier: string; severity: string; time: string; headline: string; detail: string }>;
};

export function SupplierRiskDashboardPage() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);

  const [riskInsights, setRiskInsights] = useState<SupplierRiskInsightsResponse | null>(null);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  const [remark, setRemark] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [supplierChecklistDone, setSupplierChecklistDone] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [pending, risk, sc, notifs] = await Promise.all([
        api.pendingTasks(token),
        api.supplierRisk(token),
        api.scenario(token, "supplier_delay"),
        api.notifications(token),
      ]);

      const supplierTasks = (pending as Workflow[]).filter((w) => w.current_stage === supplierRiskStage);
      setTasks(supplierTasks);
      setSelected((prev) => {
        if (prev && supplierTasks.some((x) => x.workflow_id === prev.workflow_id)) return prev;
        return supplierTasks[0] ?? null;
      });
      setRiskInsights(risk as SupplierRiskInsightsResponse);
      setScenario(sc as ScenarioResponse);
      setNotifications(notifs as NotificationItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load supplier & risk dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  async function loadTimeline(workflowId: string) {
    if (!token) return;
    const tl = await api.workflowTimeline(token, workflowId);
    setTimeline(tl as any[]);
  }

  useEffect(() => {
    if (!token) return;
    void refreshAll();
  }, [token, refreshAll]);

  useWorkflowSyncRefresh(refreshAll, [token]);

  useEffect(() => {
    if (!token || !selected) return;
    void loadTimeline(selected.workflow_id);
    setRemark("");
    setSupplierChecklistDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selected?.workflow_id]);

  const supplierList = riskInsights?.suppliers ?? [];
  const topSupplier = supplierList[0];
  const alternateSupplier = riskInsights?.alternate_supplier ?? null;
  const incidents = riskInsights?.incidents ?? [];

  const openEscalations = useMemo(() => {
    if (!selected) return [];
    return notifications
      .filter((n) => n.related_workflow_id === selected.workflow_id && !n.is_read)
      .filter((n) => n.type === "warning" || n.type === "critical" || n.type === "info")
      .slice(0, 5);
  }, [notifications, selected]);

  const disruptionAlerts = useMemo(() => {
    const alerts = supplierList
      .filter((s) => (s.delay_probability ?? 0) >= 0.2 || (s.risk_score ?? 0) >= 70)
      .slice(0, 6)
      .map((s) => ({
        severity: riskLevelFromScore(Number(s.risk_score ?? 0)).toLowerCase(),
        title: `${s.supplier} disruption risk`,
        probability: Number(s.delay_probability ?? 0),
        detail: `Delay probability ${Math.round((s.delay_probability ?? 0) * 100)}% · Risk score ${s.risk_score}`,
      }));

    return alerts;
  }, [supplierList]);

  function buildRemark(actionLabel: string) {
    const base = remark.trim();
    if (!base) return actionLabel;
    return `${base} · ${actionLabel}`;
  }

  function mapActionToUpdate(action: SupplierRiskActionKind, currentStatus: WorkflowStatus): { status: WorkflowStatus; actionLabel: string } | null {
    switch (action) {
      case "contacted":
        return { status: "In Progress", actionLabel: "Supplier contacted" };
      case "delayConfirmed":
        if (currentStatus === "Delayed") {
          // Delay already confirmed; move to mitigation/active handling.
          return { status: "In Progress", actionLabel: "Delay confirmed (mitigation in progress)" };
        }
        return { status: "Delayed", actionLabel: "Delay confirmed" };
      case "mitigationStarted":
        return { status: "In Progress", actionLabel: "Mitigation started" };
      case "alternateSuggested":
        return { status: "Escalated", actionLabel: "Alternate supplier suggested" };
      case "escalated":
        return { status: "Escalated", actionLabel: "Issue escalated" };
      case "resolved":
        if (currentStatus === "In Progress") {
          return { status: "Completed", actionLabel: "Issue resolved" };
        }
        // Keep transition-valid without multi-step calls.
        return { status: "In Progress", actionLabel: "Issue resolved (transitioning to closure)" };
      case "caseClosed":
        return null;
      default:
        return null;
    }
  }

  async function handleAction(action: SupplierRiskActionKind) {
    if (!token || !selected) return;
    setWorking(true);
    setError("");
    try {
      if (action === "caseClosed") {
        const closeRemark = buildRemark("Case closed (final mitigation completed)");
        await api.completeWorkflowStage(token, selected.workflow_id, closeRemark);
        await refreshAll();
        return;
      }

      const update = mapActionToUpdate(action, selected.status);
      if (!update) return;

      const updateRemark = buildRemark(update.actionLabel);
      await api.updateWorkflowStatus(token, selected.workflow_id, update.status, updateRemark);
      await loadTimeline(selected.workflow_id);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supplier risk action failed");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-slate-300">
        Loading supplier risk page…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold text-white">Supplier Cases</h2>
          <p className="mt-1 text-xs text-slate-400">These cases are for your team.</p>

          <div className="mt-3 space-y-3">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center">
                <p className="text-sm font-medium text-slate-100">No supplier cases</p>
                <p className="mt-1 text-xs text-slate-500">Cases will show when inventory team asks for supplier help.</p>
              </div>
            ) : (
              tasks.map((w) => (
                <SupplierCaseCard
                  key={w.workflow_id}
                  workflow={w}
                  active={selected?.workflow_id === w.workflow_id}
                  onSelect={() => setSelected(w)}
                  riskBadge={
                    (() => {
                      const score = topSupplier?.risk_score != null ? Number(topSupplier.risk_score) : 0;
                      const level = riskLevelFromScore(score);
                      return <RiskLevelBadge level={level} score={score} />;
                    })()
                  }
                />
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          {!selected ? (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-slate-300">
              Select a case to see details and take action.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Supplier Work</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {selected.workflow_id} · {selected.shipment_id} · {selected.title}
                  </p>
                </div>
                <div className="min-w-[240px]">
                  <WorkflowStageStepper currentStage={selected.current_stage} />
                </div>
              </div>

              <div className="mt-4">
                <WorkflowStageChecklist
                  workflowId={selected.workflow_id}
                  compact
                  onWorkflowUpdated={() => void refreshAll()}
                  onAllCurrentStageTasksDone={setSupplierChecklistDone}
                  showMarkComplete={false}
                  remark={remark}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Summary</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {topSupplier ? topSupplier.supplier : "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Delay chance: {topSupplier ? `${Math.round((topSupplier.delay_probability ?? 0) * 100)}%` : "—"} · Risk score:{" "}
                          {topSupplier ? topSupplier.risk_score : "—"}
                        </p>
                      </div>
                      <div>
                        {topSupplier ? (
                          <RiskLevelBadge
                            level={riskLevelFromScore(Number(topSupplier.risk_score ?? 0))}
                            score={Number(topSupplier.risk_score ?? 0)}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Supplier Scores</p>
                    <div className="mt-3">
                      <SupplierScoreCards suppliers={supplierList} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Risk Over Time</p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">Main supplier: {topSupplier ? topSupplier.supplier : "—"}</p>
                    <div className="mt-2">
                      <SupplierRiskTrendChart data={(topSupplier?.trend ?? []) as any[]} />
                    </div>
                  </div>

                  <DisruptionAlertsPanel alerts={disruptionAlerts} />

                  <SupplierComparisonTable suppliers={supplierList} />
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fix Suggestions</p>
                    <p className="mt-2 text-xs text-slate-300">{riskInsights?.recommended_mitigation ?? "No fix suggestions right now."}</p>

                    {alternateSupplier ? (
                      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                        <p className="text-xs font-semibold text-sky-200">Backup Supplier</p>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">{alternateSupplier.supplier}</p>
                            <p className="mt-1 text-xs text-slate-300">{alternateSupplier.reason}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {scenario ? (
                      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                        <p className="text-xs font-semibold text-sky-200">What-If Plan</p>
                        <p className="mt-1 text-xs text-slate-300">{scenario.scenario_name}</p>
                        <p className="mt-1 text-[0.72rem] text-slate-400">
                          Before {"->"} After: Cost {formatScenarioLogisticsCostInr(scenario.baseline.logistics_cost_musd)} {"->"} {formatScenarioLogisticsCostInr(scenario.after.logistics_cost_musd)} ·
                          ETA +{scenario.after.eta_impact_hours.toFixed(0)}h · Service {scenario.baseline.service_level_pct.toFixed(1)}% →{" "}
                          {scenario.after.service_level_pct.toFixed(1)}%
                        </p>
                        <p className="mt-2 text-[0.7rem] text-slate-400">Plan: {scenario.playbook}</p>
                      </div>
                    ) : null}
                  </div>

                  <SupplierIncidentHistoryPanel incidents={incidents as any[]} />

                  <IncidentHistoryPanel timeline={timeline} />

                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Problems</p>
                    {openEscalations.length === 0 ? (
                      <div className="mt-2 rounded border border-dashed border-slate-800 bg-slate-950/30 p-3 text-[0.7rem] text-slate-500">No open problems.</div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {openEscalations.map((n: NotificationItem) => (
                          <div key={n.id} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                            <p className="text-xs font-medium text-slate-100">
                              {n.type.toUpperCase()} · Problem
                            </p>
                            <p className="mt-1 text-[0.7rem] text-slate-300">{n.message}</p>
                            <p className="mt-1 text-[0.65rem] text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <MitigationActionPanel
                    currentStatus={selected.status}
                    remark={remark}
                    setRemark={setRemark}
                    onAction={handleAction}
                    working={working}
                    error={error}
                    caseClosedDisabled={!supplierChecklistDone}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

