const STAGES: Array<{ id: string; label: string }> = [
  { id: "planning", label: "Executive" },
  { id: "operations", label: "Operations" },
  { id: "inventory", label: "Inventory" },
  { id: "supplier_risk", label: "Supplier & Risk" },
  { id: "closed", label: "Completed" },
];

export function WorkflowStageStepper({ currentStage }: { currentStage: string }) {
  const idx = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
      {STAGES.map((s, i) => {
        const done = idx >= 0 && i < idx;
        const current = idx === i;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full border text-[0.65rem] font-semibold",
                done
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : current
                    ? "border-sky-500 bg-sky-600 text-white"
                    : "border-slate-700 bg-slate-900 text-slate-400",
              ].join(" ")}
            >
              {i + 1}
            </div>
            <span className={current ? "text-sky-200" : done ? "text-emerald-200" : "text-slate-500"}>
              {s.label}
            </span>
            {i < STAGES.length - 1 && (
              <span className="hidden h-px w-8 bg-slate-700 sm:block" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

