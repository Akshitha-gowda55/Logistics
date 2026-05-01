import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { emitWorkflowSync, WORKFLOW_SYNC_EVENT } from "../../hooks/useWorkflowSync";
import { api, type UserRole, type WorkflowStage, type WorkflowTaskItem, type WorkflowTasksResponse } from "../../lib/api";
import { pushOfflineQueue } from "../../lib/offlineQueue";

const STAGE_LABEL: Partial<Record<WorkflowStage, string>> = {
  planning: "Executive",
  operations: "Operations",
  inventory: "Warehouse",
  supplier_risk: "Supplier",
  closed: "Done",
  executive_planning: "Executive — planning",
  operations_dispatch: "Operations — routing",
  supplier_risk_check: "Supplier",
  inventory_allocation: "Warehouse",
  delivery_completion: "Operations — delivery",
  executive_review: "Executive — sign off",
};

/** Control-tower ladder order (supplier → ops → warehouse → closed). */
const STAGE_PIPELINE: WorkflowStage[] = ["supplier_risk", "operations", "inventory", "closed"];

type TowerLane = (typeof STAGE_PIPELINE)[number];

const LEGACY_TO_LANE: Partial<Record<WorkflowStage, Exclude<TowerLane, "closed">>> = {
  planning: "supplier_risk",
  executive_planning: "supplier_risk",
  supplier_risk_check: "supplier_risk",
  operations_dispatch: "operations",
  delivery_completion: "operations",
  inventory_allocation: "inventory",
  executive_review: "inventory",
};

function canonicalLane(stage: WorkflowStage): TowerLane {
  if ((STAGE_PIPELINE as readonly WorkflowStage[]).includes(stage)) {
    return stage as TowerLane;
  }
  return (LEGACY_TO_LANE[stage] ?? "supplier_risk") as TowerLane;
}

function ladderIndex(stage: WorkflowStage): number {
  return STAGE_PIPELINE.indexOf(canonicalLane(stage));
}

const STAGE_ROW_OWNER: Partial<Record<WorkflowStage, UserRole>> = {
  planning: "supplier_risk",
  supplier_risk: "supplier_risk",
  supplier_risk_check: "supplier_risk",
  executive_planning: "executive",
  operations: "operations",
  operations_dispatch: "operations",
  delivery_completion: "operations",
  inventory: "inventory",
  inventory_allocation: "inventory",
  executive_review: "executive",
  closed: "executive",
};

/** Match backend ROLE_CHECKLIST_KEYS — used when task.stage is legacy-wrong. */
const TASK_KEY_OWNER: Record<string, UserRole> = {
  order_accepted: "supplier_risk",
  material_packed: "supplier_risk",
  ready_for_pickup: "supplier_risk",
  supplier_delay_reported: "supplier_risk",
  handed_to_operations: "supplier_risk",
  vehicle_assigned: "operations",
  route_selected: "operations",
  shipment_picked_up: "operations",
  in_transit: "operations",
  delivery_delayed: "operations",
  reached_warehouse: "operations",
  shipment_received: "inventory",
  quantity_verified: "inventory",
  quality_checked: "inventory",
  stock_updated: "inventory",
  issue_reported: "inventory",
  workflow_completed: "inventory",
};

function checklistRowOwner(task: WorkflowTaskItem): UserRole | undefined {
  const byStage = STAGE_ROW_OWNER[task.stage];
  const byKey = TASK_KEY_OWNER[task.task_key];
  if (byKey !== undefined && byStage !== undefined && byKey !== byStage) return byKey;
  if (byKey !== undefined) return byKey;
  return byStage;
}

/** UI labels (match product copy; task_name from API may be older until rows are re-seeded). */
const CHECKLIST_LABEL_BY_KEY: Partial<Record<string, string>> = {
  order_accepted: "Order accepted",
  material_packed: "Raw material packed",
  ready_for_pickup: "Ready for pickup",
  supplier_delay_reported: "Supplier delay reported",
  handed_to_operations: "Handed over to operations",
  vehicle_assigned: "Vehicle assigned",
  route_selected: "Route selected",
  shipment_picked_up: "Shipment picked up",
  in_transit: "In transit",
  delivery_delayed: "Delivery delayed",
  reached_warehouse: "Reached warehouse/plant",
  shipment_received: "Shipment received",
  quantity_verified: "Quantity verified",
  quality_checked: "Quality checked",
  stock_updated: "Stock updated",
  issue_reported: "Issue reported",
  workflow_completed: "Workflow completed",
};

function rowLabel(task: WorkflowTaskItem): string {
  return CHECKLIST_LABEL_BY_KEY[task.task_key] ?? task.task_name;
}

function userMayEditTaskRow(task: WorkflowTaskItem, userRole: UserRole | undefined): boolean {
  if (!userRole || userRole === "executive") return false;
  const owner = checklistRowOwner(task);
  return owner !== undefined && owner === userRole;
}

function pipelineOrderForTasks(_tasks: WorkflowTaskItem[]): WorkflowStage[] {
  return STAGE_PIPELINE;
}

function stageRank(s: WorkflowStage, _pipeline: WorkflowStage[]): number {
  const i = ladderIndex(s);
  return i === -1 ? 999 : i;
}

function stageLabel(s: WorkflowStage): string {
  return STAGE_LABEL[s] ?? s.replace(/_/g, " ");
}

/** API ``role`` for PATCH checklist (supplier_risk maps to supplier). */
function checklistApiRole(role: UserRole): string {
  if (role === "supplier_risk") return "supplier";
  return role;
}

function teamWord(role: string): string {
  const m: Record<string, string> = {
    executive: "Executive",
    operations: "Operations",
    inventory: "Warehouse",
    supplier_risk: "Supplier",
  };
  return m[role] ?? role.replace(/_/g, " ");
}

function groupByStage(tasks: WorkflowTaskItem[]): Map<WorkflowStage, WorkflowTaskItem[]> {
  const m = new Map<WorkflowStage, WorkflowTaskItem[]>();
  for (const t of tasks) {
    const list = m.get(t.stage) ?? [];
    list.push(t);
    m.set(t.stage, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }
  return m;
}

function isStaleSyncError(message: string): boolean {
  return message.includes("409") || message.toLowerCase().includes("updated elsewhere");
}

export function WorkflowStageChecklist({
  itemName,
  compact = false,
  remark = "",
  onWorkflowUpdated,
  onAllCurrentStageTasksDone,
}: {
  itemName: string;
  compact?: boolean;
  remark?: string;
  onWorkflowUpdated?: () => void;
  /** @deprecated Prefer automatic hand-off checkboxes — kept for older dashboard panels. */
  onAllCurrentStageTasksDone?: (done: boolean) => void;
}) {
  const { token, user } = useAuth();
  const [data, setData] = useState<WorkflowTasksResponse | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskWorking, setTaskWorking] = useState<string | null>(null);
  const [netOnline, setNetOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  const load = useCallback(async () => {
    if (!token || !itemName) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.workflowTasks(token, itemName);
      setPendingEdits({});
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load work status");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, itemName]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onSync() {
      void load();
    }
    window.addEventListener(WORKFLOW_SYNC_EVENT, onSync);
    return () => window.removeEventListener(WORKFLOW_SYNC_EVENT, onSync);
  }, [load]);

  useEffect(() => {
    const online = () => {
      setNetOnline(true);
      void load();
      emitWorkflowSync();
    };
    const offline = () => setNetOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [load]);

  const currentStageTasksAllDone = useMemo(() => {
    if (!data) return false;
    const lane = canonicalLane(data.current_stage);
    const cur = data.tasks.filter((t) => canonicalLane(t.stage) === lane);
    if (!cur.length) return false;
    return cur.every((t) => pendingEdits[t.id] ?? t.is_completed);
  }, [data, pendingEdits]);

  useEffect(() => {
    onAllCurrentStageTasksDone?.(currentStageTasksAllDone);
  }, [currentStageTasksAllDone, onAllCurrentStageTasksDone]);

  async function toggleTask(task: WorkflowTaskItem, next: boolean) {
    const allowed = userMayEditTaskRow(task, user?.role);
    if (!token || !user || !allowed || taskWorking || !data) return;
    const workflowRef = itemName;
    setTaskWorking(`${workflowRef}-${task.id}`);
    setError("");
    const syncBefore = data?.sync_version ?? 0;

    if (!netOnline) {
      setPendingEdits((pe) => ({ ...pe, [task.id]: next }));
      pushOfflineQueue("PATCH_CHECKLIST", {
        workflowRef,
        role: checklistApiRole(user.role),
        field: task.task_key,
        completed: next,
        remarks: remark || "",
        expected_sync_version: syncBefore,
      });
      emitWorkflowSync();
      onWorkflowUpdated?.();
      setTaskWorking(null);
      return;
    }

    try {
      await api.patchWorkflowChecklist(token, workflowRef, {
        role: checklistApiRole(user.role),
        field: task.task_key,
        completed: next,
        remarks: remark || "",
        expected_sync_version: syncBefore,
      });
      await load();
      onWorkflowUpdated?.();
      emitWorkflowSync();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      if (isStaleSyncError(msg)) {
        setError("This item was updated elsewhere. Please review the latest status.");
        await load();
      } else {
        setError(msg);
      }
    } finally {
      setTaskWorking(null);
    }
  }

  if (!token) return null;

  if (loading) {
    return (
      <div className={compact ? "text-xs text-slate-500" : "rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400"}>
        Loading work status…
      </div>
    );
  }

  if (error && !data) {
    return <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-100">{error}</div>;
  }

  if (!data) return null;

  const pipelineOrder = pipelineOrderForTasks(data.tasks);
  const grouped = groupByStage(data.tasks);
  const stagesSorted = Array.from(grouped.keys()).sort((a, b) => stageRank(a, pipelineOrder) - stageRank(b, pipelineOrder));

  const anyEditableRow = data.tasks.some((t) => userMayEditTaskRow(t, user?.role));

  if (canonicalLane(data.current_stage) === "closed") {
    return (
      <div className={compact ? "rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-100" : "rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-100"}>
        This shipment is finished. All steps are done.
      </div>
    );
  }

  const currentLane = canonicalLane(data.current_stage);
  const currentIdx = ladderIndex(data.current_stage);

  const effectiveCompleted = (t: WorkflowTaskItem) => pendingEdits[t.id] ?? t.is_completed;

  return (
    <div className={compact ? "space-y-3" : "rounded-xl border border-slate-800 bg-slate-900/60 p-4"}>
      {!compact ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Shipment progress</p>
            <p className="mt-1 text-xs text-slate-400">
              Step: <span className="text-sky-200">{stageLabel(data.current_stage)}</span>
              <span className="text-slate-500"> · </span>
              Team with the work: {teamWord(data.current_role)}
            </p>
            <p className="mt-1 text-[0.7rem] text-slate-500">
              Use Supplier, Operations, or Warehouse dashboards to manage your checklist. Rows are keyed per shipment task (not shared across items).
              Your role can tick or clear <span className="text-sky-300">only its own checklist</span>; other sections stay read-only. Completed boxes stay
              editable until the shipment closes.
              {!netOnline ? (
                <>
                  {" "}
                  <span className="text-amber-200">Offline mode: changes saved locally</span>.
                </>
              ) : null}
            </p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[0.65rem] text-slate-300">
            {user?.role === "executive" ? "Executive — view only" : anyEditableRow ? "You can edit your rows" : "View only"}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-200">Shipment progress</p>
          <p className="text-[0.65rem] text-slate-500">
            {!netOnline ? <span className="text-amber-200">Offline — updates queued locally. </span> : null}
            {user?.role === "executive" ? "View only." : anyEditableRow ? "You can edit your rows." : "View only."}
          </p>
        </div>
      )}

      {error ? <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/15 px-2 py-1 text-[0.7rem] text-rose-100">{error}</div> : null}

      <div className={compact ? "mt-2 space-y-3" : "mt-4 space-y-4"}>
        {stagesSorted.map((stage: WorkflowStage) => {
          const items = grouped.get(stage) ?? [];
          const idx = ladderIndex(stage);
          const lane = canonicalLane(stage);
          const isCurrent = lane === currentLane;
          const isPast = idx < currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <div key={stage} className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">{stageLabel(stage)}</p>
                <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                  {isPast ? "Done" : isCurrent ? "Open" : "Later"}
                  {isFuture ? " · wait" : ""}
                </span>
              </div>
              <ul className="mt-2 space-y-2">
                {items.map((t) => {
                  const busy = taskWorking === `${itemName}-${t.id}`;
                  const checked = effectiveCompleted(t);
                  const canEditThisRow = userMayEditTaskRow(t, user?.role);
                  const disabled = !canEditThisRow || busy;

                  const showPendingBadge = !netOnline && pendingEdits[t.id] !== undefined;
                  return (
                    <li key={`${data.workflow_id}-${t.id}-${t.task_key}`} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => void toggleTask(t, e.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${checked ? "text-slate-400 line-through" : "text-slate-100"}`}>{rowLabel(t)}</p>
                        {showPendingBadge ? (
                          <p className="text-[0.65rem] text-amber-200">Offline pending sync</p>
                        ) : checked && (t.completed_by_name || t.completed_at) ? (
                          <p className="text-[0.65rem] text-slate-500">
                            {[t.completed_by_name, t.completed_at ? new Date(t.completed_at).toLocaleString() : null].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[0.65rem] text-slate-500">
        Stage moves automatically when Supplier checks &quot;Handed over to operations&quot;, Operations checks &quot;Reached warehouse/plant&quot;, or Warehouse
        checks &quot;Workflow completed&quot;.
      </p>
    </div>
  );
}
