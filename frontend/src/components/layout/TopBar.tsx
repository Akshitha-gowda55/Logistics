import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NotificationBell } from "../ui/NotificationBell";

const titles: Record<string, string> = {
  "/dashboard/executive": "Executive Page",
  "/dashboard/operations": "Operations Page",
  "/dashboard/inventory": "Inventory Page",
  "/dashboard/supplier-risk": "Supplier Risk Page",
  "/workflows": "Work Page",
  "/notifications": "Alerts Page",
  "/audit-trail": "History Page",
  "/map": "Map Page",
};

export function TopBar() {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const title = titles[loc.pathname] ?? "SmartFlow AI";

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3 backdrop-blur lg:px-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Simple supply chain workflow app</p>
        <h1 className="font-display text-xl font-semibold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <Link to="/map" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-700">
            Map
          </Link>
          <NotificationBell />
          <button onClick={logout} className="rounded-lg bg-rose-900/50 px-3 py-1.5 text-sm font-medium text-rose-100 hover:bg-rose-800/60">
            Log Out
          </button>
        </div>
        <span className="hidden rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400 sm:inline">
          {user?.name} · {user?.role}
        </span>
      </div>
    </header>
  );
}
