import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WorkflowStageChecklist } from "../workflow/WorkflowStageChecklist";
import { emitWorkflowSync } from "../../hooks/useWorkflowSync";
import { workflowDetailPath } from "../../lib/workflowRoutes";
import type { UserRole, Workflow } from "../../lib/api";

/** Put “your team’s turn” shipments first, then newest updates. */
export function sortWorkflowsForMyTasks(workflows: Workflow[], myRole: UserRole): Workflow[] {
  return [...workflows].sort((a, b) => {
    const aMine = a.current_role === myRole ? 0 : 1;
    const bMine = b.current_role === myRole ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    const ad = new Date(a.updated_at).getTime();
    const bd = new Date(b.updated_at).getTime();
    return bd - ad;
  });
}

function isOpenShipment(w: Workflow): boolean {
  return w.status !== "Closed" && w.current_stage !== "closed";
}

/**
 * Shared shipment list — full checklist page plus optional inline checklist when it is your team’s turn.
 * Sync: emitWorkflowSync + dashboard polling / visibility refresh; offline edits queue via WorkflowStageChecklist.
 */
export function ShipmentProgressTasksPanel({
  workflows,
  currentRole,
  title = "Parts → ship",
  intro = "Tap a part to open its checklist page — only the team that has the shipment now can tick boxes; other dashboards stay in sync.",
}: {
  workflows: Workflow[];
  currentRole: UserRole;
  title?: string;
  intro?: string;
}) {
  const [inlineChecklistMounted, setInlineChecklistMounted] = useState<Record<number, boolean>>({});

  const onToggleDetails = useCallback((id: number, open: boolean) => {
    if (open) {
      setInlineChecklistMounted((prev) => ({ ...prev, [id]: true }));
    }
  }, []);

  const rows = useMemo(() => {
    const open = workflows.filter(isOpenShipment);
    return sortWorkflowsForMyTasks(open, currentRole);
  }, [workflows, currentRole]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">{intro}</p>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
            No active part lines right now — or your team does not appear on these lanes yet. When work lands on your team,
            you&apos;ll manage it on its checklist page; other teams stay read-only until handoff.
          </div>
        ) : (
          rows.map((task) => {
            const canEditInline = currentRole !== "executive" && task.current_role === currentRole;
            const showQuick = canEditInline && inlineChecklistMounted[task.id];

            return (
              <div
                key={task.id}
                className="rounded-lg border border-slate-700 p-3 transition hover:border-sky-600/60 hover:bg-slate-800/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">
                        {task.item_name} · {task.shipment_id}
                      </p>
                      {currentRole === "executive" ? (
                        <span className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[0.65rem] text-slate-400">
                          Executive — view shipments only (no checklist edits)
                        </span>
                      ) : task.current_role === currentRole ? (
                        <span className="rounded-full border border-emerald-500/50 bg-emerald-950/40 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-200">
                          Your turn · checklist editable
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[0.65rem] text-slate-400">
                          View only ({task.current_role.replace("_", " ")})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-1">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Step: {task.current_stage} · Live team: {task.current_role.replace("_", " ")} · Progress:{" "}
                      {task.progress_percent}% · Supplier: {task.supplier_status ?? "—"} · Route:{" "}
                      {task.route_status ?? "—"} · Stock: {task.inventory_status ?? "—"}
                    </p>
                    <Link
                      to={workflowDetailPath(task.item_name)}
                      className="mt-2 inline-block text-xs font-semibold text-sky-400 hover:text-sky-300"
                    >
                      Open full checklist page →
                    </Link>
                  </div>
                </div>

                {canEditInline ? (
                  <details
                    className="mt-3 border-t border-slate-800 pt-2"
                    onToggle={(e) => onToggleDetails(task.id, (e.target as HTMLDetailsElement).open)}
                  >
                    <summary className="cursor-pointer list-none text-sm font-medium text-sky-300 [&::-webkit-details-marker]:hidden">
                      <span className="underline decoration-sky-500/40 underline-offset-2">Quick checklist (same as full page)</span>
                      <span className="ml-2 text-[0.65rem] font-normal text-slate-500">
                        offline OK · syncs when back online
                      </span>
                    </summary>
                    {showQuick ? (
                      <div className="mt-2" onClick={(ev) => ev.stopPropagation()}>
                        <WorkflowStageChecklist
                          itemName={task.item_name}
                          compact
                          onWorkflowUpdated={() => emitWorkflowSync()}
                        />
                      </div>
                    ) : null}
                  </details>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
