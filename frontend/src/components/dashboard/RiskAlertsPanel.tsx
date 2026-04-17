import type { DisruptionRisk } from "../../lib/api";
import { riskAlertsStatic, type RiskAlert } from "../../data/dashboardDummy";

function severityRing(sev: RiskAlert["severity"] | DisruptionRisk["severity"]) {
  if (sev === "critical") return "bg-rose-500";
  if (sev === "high") return "bg-orange-500";
  if (sev === "medium") return "bg-amber-400";
  return "bg-slate-500";
}

function mapApiRisk(r: DisruptionRisk, idx: number): RiskAlert {
  return {
    id: `ML-${idx}-${r.category}`,
    time: "Live model",
    severity: r.severity as RiskAlert["severity"],
    title: r.title,
    detail: [r.category, r.affected_site].filter(Boolean).join(" · "),
  };
}

export function RiskAlertsPanel({ apiRisks }: { apiRisks: DisruptionRisk[] }) {
  const merged: RiskAlert[] = [...riskAlertsStatic, ...apiRisks.slice(0, 4).map((r, idx) => mapApiRisk(r, idx))];

  return (
    <ul className="divide-y divide-slate-800/90">
      {merged.map((a, i) => (
        <li key={`${a.id}-${i}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityRing(a.severity)}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{a.time}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{a.id}</span>
            </div>
            <p className="mt-0.5 font-medium text-slate-100">{a.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{a.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
