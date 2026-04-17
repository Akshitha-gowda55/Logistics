import type { ReactNode } from "react";
import type { Workflow } from "../../../lib/api";

export function SupplierCaseCard({
  workflow,
  active,
  onSelect,
  riskBadge,
}: {
  workflow: Workflow;
  active: boolean;
  onSelect: () => void;
  riskBadge?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full flex-col gap-3 rounded-xl border px-3 py-3 text-left transition",
        active
          ? "border-sky-500 bg-sky-900/35"
          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-50">
            {workflow.workflow_id} · {workflow.shipment_id}
          </p>
          <p className="mt-1 line-clamp-2 text-[0.7rem] text-slate-300">{workflow.title}</p>
        </div>
        {riskBadge ? <div className="shrink-0">{riskBadge}</div> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.65rem] text-slate-400">
          Step: {workflow.current_stage} · Role: {workflow.current_role}
        </p>
        <span className="text-[0.65rem] text-slate-500">{workflow.progress_percent}%</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] text-slate-500">Status: {workflow.status}</p>
        <span
          className={[
            "rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold",
            workflow.status === "Delayed"
              ? "border-rose-500/60 bg-rose-900/60 text-rose-100"
              : workflow.status === "Escalated"
                ? "border-amber-500/60 bg-amber-900/40 text-amber-100"
                : workflow.status === "Completed"
                  ? "border-emerald-500/60 bg-emerald-900/60 text-emerald-100"
                  : "border-slate-700 bg-slate-900/50 text-slate-200",
          ].join(" ")}
        >
          {workflow.status}
        </span>
      </div>
    </button>
  );
}

