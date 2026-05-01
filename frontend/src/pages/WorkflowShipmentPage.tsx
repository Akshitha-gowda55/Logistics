import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, Workflow } from "../lib/api";
import { itemNameFromWorkflowPathParam } from "../lib/workflowRoutes";
import { roleHome } from "../components/auth/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { WorkflowStageChecklist } from "../components/workflow/WorkflowStageChecklist";
import { emitWorkflowSync, WORKFLOW_SYNC_EVENT } from "../hooks/useWorkflowSync";

/**
 * Dedicated checklist page for one shipment (`item_name` in routes).
 * Dashboards link here so checkboxes/handovers are not inlined on overview lists.
 */
export function WorkflowShipmentPage() {
  const { itemName: raw } = useParams();
  const { token, user } = useAuth();
  const itemName = itemNameFromWorkflowPathParam(raw);

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!token || !itemName) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const w = await api.workflowByItemName(token, itemName);
      setWorkflow(w);
    } catch {
      setWorkflow(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token, itemName]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onSync = () => void load();
    window.addEventListener(WORKFLOW_SYNC_EVENT, onSync);
    return () => window.removeEventListener(WORKFLOW_SYNC_EVENT, onSync);
  }, [load]);

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  const home = roleHome(user.role);

  if (!itemName) {
    return <Navigate to={home} replace />;
  }

  const onSynced = () => {
    emitWorkflowSync();
    void load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={home} className="text-sm font-medium text-sky-400 hover:text-sky-300">
          ← Back to dashboard
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">Loading shipment…</div>
      ) : notFound ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-6 text-sm text-rose-100">
          Could not load “{itemName}”. Copy the link from the dashboard (item names with spaces must stay encoded), or open the
          shipment from your task list. If the problem persists, the work item may have been removed or is not visible to your
          account.
          <Link to={home} className="mt-4 block font-medium text-sky-400">
            Return home
          </Link>
        </div>
      ) : workflow ? (
        <>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">{workflow.item_name}</h1>
            <p className="mt-1 text-xs text-slate-400">
              {workflow.shipment_id} · record #{workflow.id}
            </p>
            <p className="mt-2 text-sm text-slate-300">{workflow.title}</p>
          </div>
          <WorkflowStageChecklist itemName={workflow.item_name} onWorkflowUpdated={onSynced} remark="" />
        </>
      ) : null}
    </div>
  );
}
