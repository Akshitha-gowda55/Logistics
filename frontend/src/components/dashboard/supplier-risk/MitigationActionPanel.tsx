import type { Dispatch, SetStateAction } from "react";
import type { WorkflowStatus } from "../../../lib/api";

export type SupplierRiskActionKind =
  | "contacted"
  | "delayConfirmed"
  | "mitigationStarted"
  | "alternateSuggested"
  | "escalated"
  | "resolved"
  | "caseClosed";

export function MitigationActionPanel({
  currentStatus,
  remark,
  setRemark,
  onAction,
  working,
  error,
  caseClosedDisabled = false,
}: {
  currentStatus: WorkflowStatus;
  remark: string;
  setRemark: Dispatch<SetStateAction<string>>;
  onAction: (kind: SupplierRiskActionKind) => void | Promise<void>;
  working: boolean;
  error: string;
  /** When true, "Mark Case Closed" stays disabled until the stage checklist is complete. */
  caseClosedDisabled?: boolean;
}) {
  const disabled = working || error.length > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fix Actions</p>
          <p className="mt-1 text-[0.72rem] text-slate-300">
            Current status: <span className="font-semibold text-slate-100">{currentStatus}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onAction("contacted")}
            className="rounded-full bg-sky-600 px-3 py-1.5 text-[0.72rem] font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
          >
            Contact Supplier
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onAction("delayConfirmed")}
            className="rounded-full bg-rose-700 px-3 py-1.5 text-[0.72rem] font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
          >
            Delay Confirmed
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onAction("mitigationStarted")}
            className="rounded-full bg-emerald-700 px-3 py-1.5 text-[0.72rem] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            Fix Started
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onAction("alternateSuggested")}
            className="rounded-full bg-amber-700 px-3 py-1.5 text-[0.72rem] font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            Suggest Backup Supplier
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onAction("escalated")}
            className="rounded-full bg-orange-700 px-3 py-1.5 text-[0.72rem] font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            Report Problem
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onAction("resolved")}
            className="rounded-full bg-slate-700 px-3 py-1.5 text-[0.72rem] font-semibold text-slate-100 hover:bg-slate-600 disabled:opacity-60"
          >
            Problem Fixed
          </button>
        </div>

        <div className="mt-3">
          <label className="text-[0.7rem] text-slate-300" htmlFor="supplier-risk-remark">
            Note
          </label>
          <textarea
            id="supplier-risk-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            disabled={working}
            className="mt-2 h-20 w-full resize-none rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-[0.72rem] text-slate-100 outline-none focus:border-sky-500/60"
            placeholder="Add note..."
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[0.72rem] text-slate-400">
            {caseClosedDisabled ? "Complete every checklist item above to hand off." : "When done, close this stage for the workflow."}
          </div>
          <button
            type="button"
            disabled={disabled || caseClosedDisabled}
            onClick={() => void onAction("caseClosed")}
            className="rounded-full bg-violet-700 px-4 py-2 text-[0.72rem] font-semibold text-white hover:bg-violet-600 disabled:opacity-60"
          >
            Mark Stage Complete
          </button>
        </div>

        {error ? <p className="mt-3 text-[0.72rem] text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}

