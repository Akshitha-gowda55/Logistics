import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import { useAuth } from "./context/AuthContext";
import { AuditTrailPage } from "./pages/AuditTrailPage";
import { LoginPage } from "./pages/LoginPage";
import { MapPage } from "./pages/MapPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RoleDashboardPage } from "./pages/RoleDashboardPage";
import { WorkflowDetailsPage } from "./pages/WorkflowDetailsPage";
import { WorkflowsPage } from "./pages/WorkflowsPage";

export default function App() {
  const { user } = useAuth();
  const defaultRoute =
    user?.role === "executive"
      ? "/dashboard/executive"
      : user?.role === "operations"
        ? "/dashboard/operations"
        : user?.role === "inventory"
          ? "/dashboard/inventory"
          : "/dashboard/supplier-risk";
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard/executive" element={<ProtectedRoute roles={["executive"]}><RoleDashboardPage role="executive" /></ProtectedRoute>} />
        <Route path="/dashboard/operations" element={<ProtectedRoute roles={["executive", "operations"]}><RoleDashboardPage role="operations" /></ProtectedRoute>} />
        <Route path="/dashboard/inventory" element={<ProtectedRoute roles={["executive", "inventory"]}><RoleDashboardPage role="inventory" /></ProtectedRoute>} />
        <Route path="/dashboard/supplier-risk" element={<ProtectedRoute roles={["executive", "supplier_risk"]}><RoleDashboardPage role="supplier_risk" /></ProtectedRoute>} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:workflowId" element={<WorkflowDetailsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/audit-trail" element={<AuditTrailPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route index element={<Navigate to={defaultRoute} replace />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Route>
    </Routes>
  );
}
