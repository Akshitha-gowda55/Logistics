type TimelineRow = {
  id: number;
  stage_name: string;
  role: string;
  previous_status: string;
  new_status: string;
  remark: string;
  created_at: string;
};

export function StockMovementLog({
  timeline,
  selectedWorkflowId,
}: {
  timeline: TimelineRow[];
  selectedWorkflowId: string;
}) {
  const items = (timeline ?? []).slice().reverse().slice(0, 12);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
        Stock Move Log
      </p>
      <p className="mt-1 text-[0.7rem] text-slate-500">
        Using step history for {selectedWorkflowId}.
      </p>

      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-400 text-center">
          No inventory updates yet.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-slate-100">
                  {t.stage_name} · {t.previous_status} {"->"} {t.new_status}
                </p>
                <p className="text-[0.65rem] text-slate-500">
                  {new Date(t.created_at).toLocaleString()}
                </p>
              </div>
              {t.remark ? <p className="mt-1 text-[0.7rem] text-slate-300">{t.remark}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

