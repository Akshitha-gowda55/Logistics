import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
    isActive ? "bg-brand-600/20 text-brand-100 ring-1 ring-brand-500/40" : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100",
  ].join(" ");

export function Sidebar() {
  const { user } = useAuth();
  const role = user?.role;
  return (
    <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950/80 p-4 lg:flex">
      <div className="mb-8 px-2">
        <p className="font-display text-lg font-semibold text-white">SmartFlow AI</p>
        <p className="text-xs text-slate-500">Supply Chain App</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {(role === "executive" || role === "operations") && (
          <NavLink to="/dashboard/operations" className={linkClass}>
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Operations
          </NavLink>
        )}
        {(role === "executive" || role === "inventory") && (
          <NavLink to="/dashboard/inventory" className={linkClass}>
            <span className="h-2 w-2 rounded-full bg-violet-400" aria-hidden />
            Inventory
          </NavLink>
        )}
        {(role === "executive" || role === "supplier_risk") && (
          <NavLink to="/dashboard/supplier-risk" className={linkClass}>
            <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden />
            Supplier Risk
          </NavLink>
        )}
        {role === "executive" && (
          <NavLink to="/dashboard/executive" className={linkClass}>
            <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
            Executive
          </NavLink>
        )}
        <NavLink to="/workflows" className={linkClass}>
          <span className="h-2 w-2 rounded-full bg-cyan-300" aria-hidden />
          Work
        </NavLink>
        <NavLink to="/notifications" className={linkClass}>
          <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden />
          Alerts
        </NavLink>
        <NavLink to="/audit-trail" className={linkClass}>
          <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden />
          History
        </NavLink>
        <NavLink to="/map" className={linkClass}>
          <span className="h-2 w-2 rounded-full bg-blue-300" aria-hidden />
          Map
        </NavLink>
      </nav>
      <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-500">
        Tools: demand, stock, supplier risk, what-if.
      </div>
    </aside>
  );
}
