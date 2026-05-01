import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, Workflow, WorkflowStatus } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { InventoryTaskCard } from "../components/dashboard/inventory/InventoryTaskCard";
import { WorkflowStageStepper } from "../components/dashboard/inventory/WorkflowStageStepper";
import { StockAlertsPanel } from "../components/dashboard/inventory/StockAlertsPanel";
import { InventoryRecommendationsPanel } from "../components/dashboard/inventory/InventoryRecommendationsPanel";
import { ForecastVsStockChart } from "../components/dashboard/inventory/ForecastVsStockChart";
import { StockMovementLog } from "../components/dashboard/inventory/StockMovementLog";
import { InventoryActionsPanel, type InventoryActionKind } from "../components/dashboard/inventory/InventoryActionsPanel";
import { WarehouseStockCards } from "../components/dashboard/inventory/WarehouseStockCards";
import { InventoryStockTable } from "../components/dashboard/inventory/InventoryStockTable";
import { RebalanceRecommendationPanel } from "../components/dashboard/inventory/RebalanceRecommendationPanel";
import { WorkflowStageChecklist } from "../components/workflow/WorkflowStageChecklist";
import { InventoryDomainControlCard } from "../components/dashboard/DomainControls";
import { ShipmentProgressTasksPanel } from "../components/dashboard/ShipmentProgressTasksPanel";
import { useWorkflowSyncRefresh } from "../hooks/useWorkflowSync";

const inventoryStage = "inventory";

type ForecastResponse = {
  horizon_days: number;
  predicted_demand: number[];
  confidence: number;
  trend: string;
  recommended_action: string;
};

type InventoryInsightsResponse = {
  warehouses: Array<{
    name: string;
    region: string;
    stock_level: number;
    avg_daily_demand: number;
    projected_daily_demand: number;
    demand_variability: number;
    lead_time_days: number;
    safety_stock: number;
    reorder_point: number;
    shortage_qty: number;
    excess_qty: number;
    status: "normal" | "shortage" | "overstock" | string;
  }>;
  summary?: {
    warehouse_count: number;
    low_stock_count: number;
    excess_stock_count: number;
    network_stock: number;
    network_safety_stock: number;
    network_reorder_point: number;
    forecast_horizon_days?: number;
    network_projected_daily_demand?: number;
  };
  rebalancing_recommendation: string;
  suggested_transfer?: {
    from_warehouse: string;
    to_warehouse: string;
    quantity: number;
    reason: string;
  } | null;
};

export function InventoryControlTowerSection() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [inventoryInsights, setInventoryInsights] = useState<InventoryInsightsResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [remark, setRemark] = useState("");
  const [collabWorkflows, setCollabWorkflows] = useState<Workflow[]>([]);
  const [actionKind, setActionKind] = useState<InventoryActionKind>("received");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [invChecklistDone, setInvChecklistDone] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [pending, inv, fc, wfAll] = await Promise.all([
        api.pendingTasks(token),
        api.inventoryInsights(token),
        api.forecast(token),
        api.workflows(token),
      ]);
      const invTasks = (pending as Workflow[]).filter((w) => w.current_stage === inventoryStage);
      setTasks(invTasks);
      setCollabWorkflows(wfAll as Workflow[]);
      setSelected((prev) => {
        if (prev && invTasks.some((x) => x.item_name === prev.item_name)) return prev;
        return invTasks[0] ?? null;
      });
      setInventoryInsights(inv as InventoryInsightsResponse);
      setForecast(fc as ForecastResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory dashboard");
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
    void loadTimeline(selected.item_name);
    setRemark("");
    setActionKind("received");
    setInvChecklistDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selected?.item_name]);

  const stockSummary = useMemo(() => {
    const warehouses = inventoryInsights?.warehouses ?? [];
    const low = warehouses.filter((w) => w.status === "shortage");
    const over = warehouses.filter((w) => w.status === "overstock");
    return {
      warehouses,
      low,
      over,
      totalStock: warehouses.reduce((sum, w) => sum + (w.stock_level ?? 0), 0),
      totalSafety: warehouses.reduce((sum, w) => sum + (w.safety_stock ?? 0), 0),
    };
  }, [inventoryInsights]);

  async function performAction(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected) return;
    setWorking(true);
    setError("");
    try {
      const { status, remarkSuffix } = mapInventoryAction(actionKind);
      const combinedRemark = (remark ?? "").trim()
        ? `${remark.trim()}${remarkSuffix ? ` · ${remarkSuffix}` : ""}`
        : remarkSuffix || "Inventory action completed.";

      await api.updateWorkflowStatus(token, selected.item_name, status, combinedRemark);
      await loadTimeline(selected.item_name);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inventory action failed");
    } finally {
      setWorking(false);
    }
  }

  async function completeInventoryStage() {
    if (!token || !selected) return;
    setWorking(true);
    setError("");
    try {
      await api.completeWorkflowStage(token, selected.item_name, remark || "Warehouse processing completed. Forwarding to Supplier/Risk.");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete inventory stage");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-slate-300">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ShipmentProgressTasksPanel
        workflows={collabWorkflows}
        currentRole="inventory"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold text-white">Your warehouse jobs</h2>
          <p className="mt-1 text-xs text-slate-400">Tap a job on the left. Tick work status below when it is warehouse turn.</p>
          <div className="mt-3 space-y-3">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center">
                <p className="text-sm font-medium text-slate-100">No inventory tasks</p>
                <p className="mt-1 text-xs text-slate-500">Jobs arrive here after Operations finishes their step.</p>
              </div>
            ) : (
              tasks.map((w) => (
                <InventoryTaskCard key={w.item_name} workflow={w} active={selected?.item_name === w.item_name} onSelect={() => setSelected(w)} />
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          {!selected ? (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-slate-300">
              Select a job on the left to see checks and charts.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">This job — work status</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {selected.item_name} · {selected.shipment_id} · {selected.title}
                  </p>
                </div>
                <div className="min-w-[220px]">
                  <WorkflowStageStepper currentStage={selected.current_stage} />
                </div>
              </div>

              <div className="mt-4">
                <WorkflowStageChecklist
                  itemName={selected.item_name}
                  compact
                  onWorkflowUpdated={() => void refreshAll()}
                  onAllCurrentStageTasksDone={setInvChecklistDone}
                  remark={remark}
                />
              </div>

              <div className="mt-4">
                <InventoryDomainControlCard
                  token={token}
                  workflow={selected}
                  onSaved={(wf) => {
                    setSelected(wf);
                    void refreshAll();
                  }}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warehouse Stock</p>
                    <div className="mt-3">
                      <WarehouseStockCards warehouses={stockSummary.warehouses as any[]} />
                    </div>
                  </div>
                  <StockAlertsPanel warehouses={stockSummary.warehouses} />
                  <InventoryRecommendationsPanel inventoryInsights={inventoryInsights} forecast={forecast} />
                  <RebalanceRecommendationPanel
                    recommendation={inventoryInsights?.rebalancing_recommendation ?? "No move-stock suggestions right now."}
                    suggestedTransfer={inventoryInsights?.suggested_transfer ?? null}
                  />
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demand vs Stock</p>
                    <div className="mt-2">
                      <ForecastVsStockChart inventoryInsights={inventoryInsights} forecast={forecast} />
                    </div>
                  </div>

                  <StockMovementLog timeline={timeline} selectedItemName={selected.item_name} />
                </div>
              </div>

              <div className="mt-4">
                <InventoryStockTable warehouses={(inventoryInsights?.warehouses ?? []) as any[]} />
              </div>

              <form onSubmit={performAction} className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Inventory Actions</p>
                    <p className="mt-1 text-xs text-slate-400">Save warehouse updates. Done step moves work to next team.</p>
                  </div>
                </div>

                <InventoryActionsPanel actionKind={actionKind} setActionKind={setActionKind} remark={remark} setRemark={setRemark} />

                {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={working}
                    className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
                  >
                    {working ? "Saving…" : "Save Update"}
                  </button>
                  <button
                    type="button"
                    disabled={working || !invChecklistDone}
                    onClick={completeInventoryStage}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {working ? "Completing…" : "Mark Stage Complete"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function mapInventoryAction(kind: InventoryActionKind): { status: WorkflowStatus; remarkSuffix: string } {
  switch (kind) {
    case "received":
      return { status: "In Progress", remarkSuffix: "Stock received" };
    case "packed":
      return { status: "In Progress", remarkSuffix: "Stock packed" };
    case "transferred":
      return { status: "In Progress", remarkSuffix: "Stock transferred" };
    case "delayed":
      return { status: "Delayed", remarkSuffix: "Stock delayed" };
    case "unavailable":
      return { status: "Escalated", remarkSuffix: "Stock unavailable" };
    default:
      return { status: "In Progress", remarkSuffix: "Inventory update" };
  }
}

