import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, AuditLogItem, NotificationItem, Workflow, WorkflowShipmentDetails, WorkflowStatus, WorkflowUpdate } from "../lib/api";
import { WorkflowStageTimeline } from "../components/workflow-details/WorkflowStageTimeline";
import { RemarkHistory } from "../components/workflow-details/RemarkHistory";
import { NotificationsLinkedPanel } from "../components/workflow-details/NotificationsLinkedPanel";
import { AuditPreviewPanel } from "../components/workflow-details/AuditPreviewPanel";
import { SelectedRouteSummary } from "../components/workflow-details/SelectedRouteSummary";
import { WorkflowStageChecklist } from "../components/workflow/WorkflowStageChecklist";
import { emitWorkflowSync, useWorkflowSyncRefresh } from "../hooks/useWorkflowSync";

export function WorkflowDetailsPage() {
  const { workflowId = "" } = useParams();
  const { token, user } = useAuth();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [timeline, setTimeline] = useState<WorkflowUpdate[]>([]);
  const [shipment, setShipment] = useState<WorkflowShipmentDetails | null>(null);
  const [audit, setAudit] = useState<AuditLogItem[]>([]);
  const [linkedNotifications, setLinkedNotifications] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>("In Progress");
  const [remark, setRemark] = useState("");
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** When the main workflow loads but a secondary API fails, we still show the page and list what broke. */
  const [partialLoadWarnings, setPartialLoadWarnings] = useState<string[]>([]);
  const [stageChecklistDone, setStageChecklistDone] = useState(false);

  function errText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }

  const load = useCallback(async () => {
    if (!workflowId) {
      setLoading(false);
      setWorkflow(null);
      setError("Invalid workflow link.");
      setPartialLoadWarnings([]);
      return;
    }
    if (!token) {
      setLoading(false);
      setWorkflow(null);
      setError("");
      setPartialLoadWarnings([]);
      return;
    }
    setLoading(true);
    setError("");
    setPartialLoadWarnings([]);
    try {
      const wf = await api.workflowById(token, workflowId);
      setWorkflow(wf);

      const settled = await Promise.allSettled([
        api.workflowTimeline(token, workflowId),
        api.workflowShipmentDetails(token, workflowId),
        api.workflowAudit(token, workflowId),
        api.notifications(token),
      ]);
      const labels = ["Timeline", "Shipment details", "Audit trail", "Notifications"] as const;
      const warnings: string[] = [];
      settled.forEach((r, i) => {
        if (r.status === "rejected") {
          warnings.push(`${labels[i]} — ${errText(r.reason)}`);
        }
      });
      setPartialLoadWarnings(warnings);

      setTimeline(settled[0].status === "fulfilled" ? settled[0].value : []);
      setShipment(settled[1].status === "fulfilled" ? settled[1].value : null);
      setAudit(settled[2].status === "fulfilled" ? settled[2].value : []);
      if (settled[3].status === "fulfilled") {
        const notifs = settled[3].value as NotificationItem[];
        setLinkedNotifications(notifs.filter((n) => n.related_workflow_id === workflowId));
      } else {
        setLinkedNotifications([]);
      }
    } catch (e) {
      setWorkflow(null);
      setTimeline([]);
      setShipment(null);
      setAudit([]);
      setLinkedNotifications([]);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [token, workflowId]);

  useEffect(() => {
    void load();
  }, [load]);

  useWorkflowSyncRefresh(load, [token, workflowId]);

  useEffect(() => {
    setStageChecklistDone(false);
  }, [workflowId, workflow?.current_stage]);

  async function updateStatus(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setWorking(true);
    setError("");
    try {
      await api.updateWorkflowStatus(token, workflowId, status, remark);
      setRemark("");
      await load();
      emitWorkflowSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setWorking(false);
    }
  }

  async function quickStatus(next: WorkflowStatus, defaultRemark: string) {
    if (!token) return;
    setWorking(true);
    setError("");
    try {
      await api.updateWorkflowStatus(token, workflowId, next, remark || defaultRemark);
      setRemark("");
      await load();
      emitWorkflowSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setWorking(false);
    }
  }

  async function addRemarkOnly() {
    if (!token) return;
    if (!remark.trim()) return;
    setWorking(true);
    setError("");
    try {
      await api.addWorkflowRemark(token, workflowId, remark.trim());
      setRemark("");
      await load();
      emitWorkflowSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add remark");
    } finally {
      setWorking(false);
    }
  }

  async function completeStage() {
    if (!token) return;
    setWorking(true);
    setError("");
    try {
      await api.completeWorkflowStage(token, workflowId, remark || "Stage completed by current owner.");
      setRemark("");
      await load();
      emitWorkflowSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete stage");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-slate-200">Loading work details…</div>;
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-amber-100">
        Sign in to view workflow details.
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-rose-100">
        <p className="font-semibold">Could not load this workflow</p>
        <p className="text-sm whitespace-pre-wrap break-words">
          {error ||
            `No data for “${workflowId}”. It may not exist, your role may not allow access, or the server returned an error.`}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-600"
        >
          Try again
        </button>
      </div>
    );
  }

  const canAct = user?.role === "executive" || user?.role === workflow.current_role;
  const headerMeta = useMemo(() => {
    return [
      { label: "Shipment", value: workflow.shipment_id },
      { label: "Priority", value: workflow.priority },
      { label: "Status", value: workflow.status },
      { label: "Progress", value: `${workflow.progress_percent}%` },
      { label: "Stage", value: workflow.current_stage },
      { label: "Assigned To", value: workflow.current_role },
    ];
  }, [workflow]);

  return (
    <div className="space-y-4">
      {partialLoadWarnings.length ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 text-sm text-amber-100">
          <p className="font-semibold text-amber-50">Some sections could not load (workflow details below are shown)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-100/95">
            {partialLoadWarnings.map((w, i) => (
              <li key={i} className="whitespace-pre-wrap break-words">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {workflow.workflow_id} · {workflow.title}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{workflow.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              {workflow.source_location} {"->"} {workflow.destination_location}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Assigned To</p>
            <p className="mt-1">
              {workflow.current_role} {workflow.assigned_user_id ? `(user #${workflow.assigned_user_id})` : "(unassigned)"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {headerMeta.map((m) => (
            <div key={m.label} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[0.7rem] text-slate-500">{m.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 h-2 rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-sky-500" style={{ width: `${workflow.progress_percent}%` }} />
        </div>
      </section>

      <WorkflowStageChecklist
        workflowId={workflow.workflow_id}
        onWorkflowUpdated={() => void load()}
        onAllCurrentStageTasksDone={setStageChecklistDone}
        showMarkComplete={false}
        remark={remark}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <WorkflowStageTimeline workflow={workflow} timeline={timeline} />
          <SelectedRouteSummary shipment={shipment} />
          <RemarkHistory timeline={timeline} />
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-sm font-semibold text-slate-100">Actions</p>
            <p className="mt-1 text-xs text-slate-400">
              Only the current team (or executive) can update this step.
            </p>

            {error ? <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-100">{error}</div> : null}

            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="text-[0.7rem] text-slate-400">Note</span>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500/60"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Add a note…"
                  disabled={!canAct || working}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!canAct || working}
                  onClick={() => {
                    void quickStatus("In Progress", "Marked in progress.");
                  }}
                  className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  Start Work
                </button>
                <button
                  type="button"
                  disabled={!canAct || working}
                  onClick={addRemarkOnly}
                  className="rounded-full bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-60"
                >
                  Add Note
                </button>
              </div>

              <form onSubmit={updateStatus} className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-[0.7rem] text-slate-400">Update Status</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500/60"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
                    disabled={!canAct || working}
                  >
                    <option>Assigned</option>
                    <option>In Progress</option>
                    <option>Delayed</option>
                    <option>Escalated</option>
                    <option>Completed</option>
                  </select>
                </label>
                <button
                  disabled={!canAct || working}
                  className="w-full rounded-full bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                >
                  Save Status
                </button>
              </form>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!canAct || working}
                  onClick={() => {
                    void quickStatus("Escalated", "Escalated for review.");
                  }}
                  className="rounded-full bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  Report Problem
                </button>
                <button
                  type="button"
                  disabled={
                    !canAct ||
                    working ||
                    workflow.current_stage === "closed" ||
                    !stageChecklistDone
                  }
                  onClick={completeStage}
                  className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  Mark Stage Complete
                </button>
              </div>
            </div>
          </section>

          <NotificationsLinkedPanel items={linkedNotifications} />
          <AuditPreviewPanel items={audit} />
        </div>
      </div>
    </div>
  );
}
