import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { emitWorkflowSync, WORKFLOW_SYNC_EVENT } from "../../hooks/useWorkflowSync";
import { api, type WorkflowStage, type WorkflowTaskItem, type WorkflowTasksResponse } from "../../lib/api";

const STAGE_LABEL: Record<WorkflowStage, string> = {
  planning: "Executive",
  operations: "Operations",
  inventory: "Inventory",
  supplier_risk: "Supplier & Risk",
  closed: "Completed",
};

const STAGE_ORDER: WorkflowStage[] = ["planning", "operations", "inventory", "supplier_risk", "closed"];

function stageRank(s: WorkflowStage): number {
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 99 : i;
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

export function WorkflowStageChecklist({
  workflowId,
  compact = false,
  showMarkComplete = false,
  remark = "",
  onWorkflowUpdated,
  onAllCurrentStageTasksDone,
}: {
  workflowId: string;
  compact?: boolean;
  showMarkComplete?: boolean;
  remark?: string;
  onWorkflowUpdated?: () => void;
  onAllCurrentStageTasksDone?: (done: boolean) => void;
}) {
  const { token, user } = useAuth();
  const [data, setData] = useState<WorkflowTasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [taskWorking, setTaskWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !workflowId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.workflowTasks(token, workflowId);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load checklist");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, workflowId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener(WORKFLOW_SYNC_EVENT, refresh);
    return () => window.removeEventListener(WORKFLOW_SYNC_EVENT, refresh);
  }, [load]);

  const currentStageTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((t: WorkflowTaskItem) => t.stage === data.current_stage);
  }, [data]);

  const allCurrentDone = useMemo(() => {
    if (!data || currentStageTasks.length === 0) return false;
    return currentStageTasks.every((t: WorkflowTaskItem) => t.is_completed);
  }, [data, currentStageTasks]);

  useEffect(() => {
    onAllCurrentStageTasksDone?.(allCurrentDone);
  }, [allCurrentDone, onAllCurrentStageTasksDone]);

  async function toggleTask(task: WorkflowTaskItem, next: boolean) {
    if (!token || !task.can_edit || working) return;
    setTaskWorking(task.task_key);
    setError("");
    try {
      const updated = await api.updateWorkflowTask(token, workflowId, task.task_key, next);
      setData((prev: WorkflowTasksResponse | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((x: WorkflowTaskItem) => (x.task_key === updated.task_key ? { ...x, ...updated } : x)),
        };
      });
      onWorkflowUpdated?.();
      emitWorkflowSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setTaskWorking(null);
    }
  }

  async function markStageComplete() {
    if (!token || !allCurrentDone) return;
    setWorking(true);
    setError("");
    try {
      await api.completeWorkflowStage(token, workflowId, remark || "Stage completed via checklist.");
      await load();
      onWorkflowUpdated?.();
      emitWorkflowSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete stage");
    } finally {
      setWorking(false);
    }
  }

  if (!token) return null;

  if (loading) {
    return (
      <div className={compact ? "text-xs text-slate-500" : "rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400"}>
        Loading checklist…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-100">
        {error}
      </div>
    );
  }

  if (!data) return null;

  if (data.current_stage === "closed") {
    return (
      <div className={compact ? "rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-100" : "rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-100"}>
        Workflow completed — all supply-chain stages are finished.
      </div>
    );
  }

  const grouped = groupByStage(data.tasks);
  const stagesSorted = Array.from(grouped.keys()).sort((a, b) => stageRank(a) - stageRank(b));

  const currentIdx = STAGE_ORDER.indexOf(data.current_stage);

  return (
    <div className={compact ? "space-y-3" : "rounded-xl border border-slate-800 bg-slate-900/60 p-4"}>
      {!compact ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Stage checklist</p>
            <p className="mt-1 text-xs text-slate-400">
              Current stage: <span className="text-sky-200">{STAGE_LABEL[data.current_stage]}</span> · Role: {data.current_role}
            </p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[0.65rem] text-slate-300">
            {user?.role === data.current_role ? "You can edit this stage" : "View only"}
          </span>
        </div>
      ) : (
        <p className="text-xs font-semibold text-slate-200">Checklist</p>
      )}

      {error ? <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/15 px-2 py-1 text-[0.7rem] text-rose-100">{error}</div> : null}

      <div className={compact ? "mt-2 space-y-3" : "mt-4 space-y-4"}>
        {stagesSorted.map((stage: WorkflowStage) => {
          const items = grouped.get(stage) ?? [];
          const idx = STAGE_ORDER.indexOf(stage);
          const isPast = currentIdx !== -1 && idx < currentIdx;
          const isCurrent = stage === data.current_stage;
          const isFuture = currentIdx !== -1 && idx > currentIdx;

          return (
            <div key={stage} className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">{STAGE_LABEL[stage]}</p>
                <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                  {isPast ? "Done" : isCurrent ? "In progress" : "Waiting"}
                  {isFuture ? " · Locked" : ""}
                </span>
              </div>
              <ul className="mt-2 space-y-2">
                {items.map((t) => {
                  const busy = taskWorking === t.task_key;
                  const disabled = !t.can_edit || busy || isFuture;
                  return (
                    <li key={t.task_key} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        checked={t.is_completed}
                        disabled={disabled}
                        onChange={(e) => void toggleTask(t, e.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${t.is_completed ? "text-slate-400 line-through" : "text-slate-100"}`}>{t.task_name}</p>
                        {t.is_completed && t.completed_by_name ? (
                          <p className="text-[0.65rem] text-slate-500">
                            {t.completed_by_name}
                            {t.completed_at ? ` · ${new Date(t.completed_at).toLocaleString()}` : ""}
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

      {showMarkComplete ? (
        <div className={compact ? "mt-3" : "mt-4"}>
          <button
            type="button"
            disabled={!allCurrentDone || working}
            onClick={() => void markStageComplete()}
            className="w-full rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working ? "Working…" : "Mark Stage Complete"}
          </button>
          {!allCurrentDone ? (
            <p className="mt-2 text-center text-[0.65rem] text-slate-500">Complete every checkbox for this stage to enable handoff.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
