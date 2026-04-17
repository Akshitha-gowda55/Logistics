export function PlaybookPanel({ playbook, actions }: { playbook: string; actions: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Fix Plan</p>
      <p className="mt-2 text-xs text-slate-300">{playbook || "No fix plan available."}</p>
      {actions.length ? (
        <div className="mt-3 space-y-2">
          {actions.map((a, idx) => (
            <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[0.72rem] text-slate-200">
              <span className="text-slate-500">{idx + 1}.</span> {a}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

