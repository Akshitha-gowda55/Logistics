import type { Workflow } from "../../../lib/api";

import { Link } from "react-router-dom";
import { workflowDetailPath } from "../../../lib/workflowRoutes";



const STAGE_LABEL: Record<string, string> = {

  executive_planning: "Executive planning",

  operations_dispatch: "Operations",

  supplier_risk_check: "Supplier",

  inventory_allocation: "Warehouse",

  delivery_completion: "Delivery",

  executive_review: "Executive review",

  closed: "Done",

  planning: "Executive",

  operations: "Operations",

  inventory: "Warehouse",

  supplier_risk: "Supplier",

};



function stageLabel(s: string): string {

  return STAGE_LABEL[s] ?? s.replace(/_/g, " ");

}



/** Plain label for Current team badge */

function liveTeamLabel(role: string): string {

  const m: Record<string, string> = {

    executive: "Executive",

    operations: "Operations",

    inventory: "Warehouse",

    supplier_risk: "Supplier",

  };

  return m[role] ?? role.replace(/_/g, " ");

}



export function ExecutiveWorkflowOverview({ workflows }: { workflows: Workflow[] }) {

  if (!workflows.length) {

    return (

      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">

        No shipments yet.

      </div>

    );

  }



  return (

    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">

      <div className="flex flex-wrap items-start justify-between gap-2">

        <div>

          <h3 className="text-sm font-semibold text-white">All shipments</h3>

          <p className="mt-1 text-xs text-slate-400">

            Four part lines (and more). Tap a row to open the checklist page; status updates everywhere.

          </p>

        </div>

      </div>

      <div className="mt-4 space-y-3">

        {workflows.map((w) => (

          <div key={w.item_name} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">

            <div className="flex flex-wrap items-center justify-between gap-2">

              <span className="text-sm font-semibold text-white">{w.item_name}</span>

              <span className="text-[0.65rem] text-slate-500">{w.shipment_id}</span>

            </div>

            <p className="mt-1 text-xs text-slate-400 line-clamp-1">{w.title}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-400">

              <span>Step: {stageLabel(w.current_stage)}</span>

              <span>·</span>

              <span>Team with the work now: {liveTeamLabel(w.current_role)}</span>

              <span>·</span>

              <span>State: {w.status}</span>

            </div>

            <div className="mt-2 h-2 w-full rounded-full bg-slate-800">

              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, w.progress_percent)}%` }} />

            </div>

            <p className="mt-1 text-[0.65rem] text-slate-500">{w.progress_percent}% done</p>



            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                to={workflowDetailPath(w.item_name)}
                className="inline-flex rounded-full border border-sky-600/60 bg-sky-950/30 px-3 py-1 text-[0.75rem] font-semibold text-sky-200 hover:bg-sky-900/40"
              >
                Open checklist page
              </Link>
            </div>

            {w.current_role === "executive" ? (

              <div className="mt-2 rounded-lg border border-sky-900/40 bg-sky-950/20 px-2 py-1.5 text-[0.7rem] text-sky-200/90">

                Executive turn — open the page above to tick your box and hand off.

              </div>

            ) : (

              <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2 py-1.5 text-[0.7rem] text-slate-400">

                View only. {liveTeamLabel(w.current_role)} has the checklist on the page above.

              </div>

            )}

          </div>

        ))}

      </div>

    </div>

  );

}

