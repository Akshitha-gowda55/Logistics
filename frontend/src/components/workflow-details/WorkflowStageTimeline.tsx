import type { Workflow, WorkflowUpdate } from "../../lib/api";

const STAGES: Array<{ id: Workflow["current_stage"]; label: string }> = [
  { id: "planning", label: "Executive" },
  { id: "operations", label: "Operations" },
  { id: "inventory", label: "Inventory" },
  { id: "supplier_risk", label: "Supplier & Risk" },
  { id: "closed", label: "Completed" },
];

function stageIndex(stage: string) {
  return STAGES.findIndex((s) => s.id === stage);
}

export function WorkflowStageTimeline({ workflow, timeline }: { workflow: Workflow; timeline: WorkflowUpdate[] }) {
  const currentIdx = stageIndex(workflow.current_stage);
  const completedStages = new Set(
    timeline.filter((t) => t.new_status === "Completed").map((t) => t.stage_name),
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-semibold text-slate-100">Step Timeline</p>
      <p className="mt-1 text-xs text-slate-400">Executive {"->"} Operations {"->"} Inventory {"->"} Supplier & Risk {"->"} Completed</p>
      <div className="mt-4 space-y-2">
        {STAGES.map((s, idx) => {
          const done = completedStages.has(s.id as any) || (currentIdx !== -1 && idx < currentIdx);
          const current = idx === currentIdx;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <span
                className={[
                  "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  done
                    ? "border-emerald-500 bg-emerald-700 text-white"
                    : current
                      ? "border-sky-500 bg-sky-700 text-white"
                      : "border-slate-700 bg-slate-900 text-slate-400",
                ].join(" ")}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={["text-sm font-semibold", current ? "text-sky-200" : done ? "text-emerald-200" : "text-slate-300"].join(" ")}>
                  {s.label}
                </p>
                <p className="mt-0.5 text-[0.7rem] text-slate-500">
                  {current ? `Current team: ${workflow.current_role}` : done ? "Done" : "Pending"}
                </p>
              </div>
              <span className="text-[0.7rem] text-slate-500">{done ? "Done" : current ? "Active" : "Locked"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

