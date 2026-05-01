import type { Workflow } from "../../../lib/api";

export function InventoryTaskCard({
  workflow,
  active,
  onSelect,
}: {
  workflow: Workflow;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full flex-col gap-2 rounded-xl border px-3 py-2 text-left transition",
        active
          ? "border-sky-500 bg-sky-900/35"
          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">
            {workflow.item_name} · {workflow.shipment_id}
          </p>
          <p className="mt-1 line-clamp-2 text-[0.7rem] text-slate-300">{workflow.title}</p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-semibold ring-1",
            workflow.status === "Delayed"
              ? "border-rose-500/60 bg-rose-900/60 text-rose-100"
              : workflow.status === "Completed"
                ? "border-emerald-500/60 bg-emerald-900/60 text-emerald-100"
                : "border-sky-500/60 bg-sky-900/60 text-sky-100",
          ].join(" ")}
        >
          {workflow.status}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.65rem] text-slate-400">
          {workflow.source_location} → {workflow.destination_location}
        </p>
        <p className="text-[0.65rem] text-slate-500">{workflow.progress_percent}%</p>
      </div>
    </button>
  );
}

