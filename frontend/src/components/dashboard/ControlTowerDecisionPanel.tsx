import { useEffect, useState } from "react";
import { api, type DecisionInsight } from "../../lib/api";
import { emitWorkflowSync } from "../../hooks/useWorkflowSync";

export function ControlTowerDecisionPanel({
  token,
  itemName,
}: {
  token: string | null;
  itemName?: string | null;
}) {
  const [data, setData] = useState<DecisionInsight | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) return;
    setErr("");
    void api
      .decision(token, itemName ?? undefined)
      .then((d) => {
        setData(d);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Decision unavailable."));
  }, [token, itemName]);

  const pri = data?.priority ?? "low";
  const tone =
    pri === "high" ? "border-rose-500/50 bg-rose-950/20 text-rose-50" : pri === "medium" ? "border-amber-500/40 bg-amber-950/20 text-amber-50" : "border-slate-700 bg-slate-900/60 text-slate-100";

  return (
    <section className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-70">Guidance</p>
          <h2 className="text-lg font-semibold text-white">What to watch next</h2>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.7rem] font-medium hover:bg-white/10"
          onClick={() => {
            emitWorkflowSync();
            if (token)
              void api.decision(token, itemName ?? undefined).then(setData).catch(() => {});
          }}
        >
          Refresh
        </button>
      </div>
      {err ? <p className="mt-2 text-xs text-rose-200">{err}</p> : null}
      {!data && !err ? <p className="mt-2 text-xs opacity-70">Loading…</p> : null}
      {data ? (
        <div className="mt-3 space-y-2 text-sm leading-relaxed">
          <p>
            <span className="text-xs uppercase tracking-wide opacity-70">Issue: </span>
            {data.problem}
          </p>
          <p>
            <span className="text-xs uppercase tracking-wide opacity-70">Impact: </span>
            {data.impact}
          </p>
          <p className="rounded-lg border border-white/10 bg-black/15 p-2 text-xs">
            <span className="font-semibold">Suggested move: </span>
            {data.recommended_action}
          </p>
          <p className="text-[0.65rem] uppercase tracking-wide opacity-60">Priority: {data.priority}</p>
        </div>
      ) : null}
    </section>
  );
}
