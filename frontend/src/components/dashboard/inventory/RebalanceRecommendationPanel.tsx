type SuggestedTransfer = {
  from_warehouse: string;
  to_warehouse: string;
  quantity: number;
  reason: string;
} | null;

export function RebalanceRecommendationPanel({
  recommendation,
  suggestedTransfer,
}: {
  recommendation: string;
  suggestedTransfer: SuggestedTransfer;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">Move Stock Suggestion</p>
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <p className="text-sm font-semibold text-slate-100">{recommendation}</p>
        {suggestedTransfer ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Cell label="From" value={suggestedTransfer.from_warehouse} />
            <Cell label="To" value={suggestedTransfer.to_warehouse} />
            <Cell label="Amount" value={String(suggestedTransfer.quantity)} />
          </div>
        ) : null}
        {suggestedTransfer?.reason ? <p className="mt-2 text-[0.72rem] text-slate-400">{suggestedTransfer.reason}</p> : null}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
      <p className="text-[0.65rem] text-slate-500">{label}</p>
      <p className="mt-1 text-[0.75rem] font-semibold text-slate-100">{value}</p>
    </div>
  );
}

