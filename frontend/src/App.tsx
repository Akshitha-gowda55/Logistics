import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { RoleDashboardPage } from "./pages/RoleDashboardPage";
import { WorkflowShipmentPage } from "./pages/WorkflowShipmentPage";

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
        <Route path="/dashboard/supplier" element={<Navigate to="/dashboard/supplier-risk" replace />} />
        <Route index element={<Navigate to={defaultRoute} replace />} />
        <Route path="/workflows/:itemName" element={<WorkflowShipmentPage />} />
        <Route path="/workflows" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/notifications" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/audit-trail" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/map" element={<Navigate to="/dashboard/operations" replace />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Route>
    </Routes>
  );
}
