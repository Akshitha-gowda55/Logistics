import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "../../lib/api";

export function ProtectedRoute({ roles, children }: { roles?: UserRole[]; children: JSX.Element }) {
  const { loading, user } = useAuth();
  if (loading) return <div className="p-8 text-slate-200">Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}

export function roleHome(role: UserRole): string {
  if (role === "executive") return "/dashboard/executive";
  if (role === "operations") return "/dashboard/operations";
  if (role === "inventory") return "/dashboard/inventory";
  return "/dashboard/supplier-risk";
}
