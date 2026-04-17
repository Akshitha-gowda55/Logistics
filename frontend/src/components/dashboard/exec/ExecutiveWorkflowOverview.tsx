import { Link } from "react-router-dom";
import type { Workflow } from "../../../lib/api";

const STAGE_LABEL: Record<string, string> = {
  planning: "Executive",
  operations: "Operations",
  inventory: "Inventory",
  supplier_risk: "Supplier & Risk",
  closed: "Completed",
};

function stageLabel(s: string): string {
  return STAGE_LABEL[s] ?? s;
}

export function ExecutiveWorkflowOverview({ workflows }: { workflows: Workflow[] }) {
  if (!workflows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
        No workflows in the system yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Fleet progress (synced)</h3>
          <p className="mt-1 text-xs text-slate-400">
            High-level status across all workflows. Updates when any role checks off tasks or completes a stage.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {workflows.map((w) => (
          <div key={w.workflow_id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/workflows/${w.workflow_id}`} className="text-sm font-semibold text-sky-200 hover:underline">
                {w.workflow_id}
              </Link>
              <span className="text-[0.65rem] text-slate-500">{w.shipment_id}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400 line-clamp-1">{w.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-400">
              <span>Stage: {stageLabel(w.current_stage)}</span>
              <span>·</span>
              <span>Owner: {w.current_role}</span>
              <span>·</span>
              <span>Status: {w.status}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, w.progress_percent)}%` }} />
            </div>
            <p className="mt-1 text-[0.65rem] text-slate-500">{w.progress_percent}% complete</p>
          </div>
        ))}
      </div>
    </div>
  );
}
