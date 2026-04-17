const API_BASE = "/api/v1";

type RequestMethod = "GET" | "POST" | "PATCH";

/** Turns FastAPI / HTTP error bodies into a short, readable message for the UI. */
export function formatHttpError(status: number, statusText: string, bodyText: string): string {
  const raw = bodyText.trim();
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as { detail?: unknown };
      if (typeof j.detail === "string") {
        return `${status} ${statusText}: ${j.detail}`;
      }
      if (Array.isArray(j.detail)) {
        const parts = j.detail.map((item: unknown) => {
          if (item && typeof item === "object" && "msg" in item) {
            const o = item as { msg?: string; loc?: unknown };
            const loc = Array.isArray(o.loc) ? o.loc.join(".") : "";
            return loc ? `${loc}: ${o.msg ?? ""}` : String(o.msg ?? item);
          }
          return JSON.stringify(item);
        });
        return `${status} ${statusText}: ${parts.join("; ")}`;
      }
      if (j.detail != null) {
        return `${status} ${statusText}: ${JSON.stringify(j.detail)}`;
      }
    } catch {
      /* fall through */
    }
  }
  if (raw.startsWith("<!") || raw.toLowerCase().includes("<html")) {
    return `${status} ${statusText}: Server returned an HTML error page (check backend logs for the traceback).`;
  }
  if (raw) {
    const short = raw.length > 600 ? `${raw.slice(0, 600)}…` : raw;
    return `${status} ${statusText}: ${short}`;
  }
  return `${status} ${statusText || "Error"}`;
}

async function request<T>(path: string, method: RequestMethod, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatHttpError(res.status, res.statusText, text));
  }
  return res.json() as Promise<T>;
}

export type UserRole = "executive" | "operations" | "inventory" | "supplier_risk";
export type WorkflowStatus = "Pending" | "Assigned" | "In Progress" | "Waiting for Next Team" | "Delayed" | "Escalated" | "Completed" | "Closed";
export type WorkflowStage = "planning" | "operations" | "inventory" | "supplier_risk" | "closed";

export type AuthUser = { id: number; name: string; email: string; role: UserRole };
export type LoginResponse = { access_token: string; token_type: "bearer"; user: AuthUser };

export type Workflow = {
  id: number;
  workflow_id: string;
  shipment_id: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  source_location: string;
  destination_location: string;
  current_stage: WorkflowStage;
  current_role: UserRole;
  assigned_user_id: number | null;
  assigned_role: UserRole;
  status: WorkflowStatus;
  progress_percent: number;
  due_date: string | null;
  remarks: string;
  final_outcome?: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationItem = {
  id: number;
  message: string;
  type: "info" | "warning" | "critical" | "success";
  related_workflow_id: string;
  is_read: boolean;
  created_at: string;
};

export type WorkflowUpdate = {
  id: number;
  workflow_id: string;
  stage_name: WorkflowStage;
  role: UserRole;
  previous_status: WorkflowStatus;
  new_status: WorkflowStatus;
  remark: string;
  completed_at?: string | null;
  created_at: string;
};

export type ShipmentRouteSummary = {
  route_code: string;
  distance_km: number;
  eta_hours: number;
  /** Transport cost in Indian Rupees (₹). API field name is legacy `cost_usd`. */
  cost_usd: number;
  co2_kg: number;
  disruption_risk: string;
};

export type WorkflowShipmentDetails = {
  shipment_id: string;
  current_status: string;
  progress_percent: number;
  eta: string | null;
  selected_route: ShipmentRouteSummary | null;
};

export type AuditLogItem = {
  id: number;
  user_id: number;
  workflow_id?: string | null;
  action_type: string;
  module_name: string;
  details: string;
  created_at: string;
};

export type AuditTrailItem = {
  id: number;
  user_id: number;
  user_name: string | null;
  user_role: UserRole | null;
  workflow_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  action_type: string;
  module_name: string;
  remark: string | null;
  details: string;
  created_at: string;
};

export type AuditTrailQuery = {
  role?: UserRole;
  workflow_id?: string;
  start?: string; // ISO
  end?: string; // ISO
  action_type?: string;
  module_name?: string;
  limit?: number;
  offset?: number;
};

export type DashboardSummaryResponse = {
  role: UserRole;
  summary: {
    total_workflows: number;
    active_workflows: number;
    completed_workflows: number;
    delayed_workflows: number;
    on_time_delivery_pct: number;
    /** Logistics cost in ₹ Crore (1.0 = ₹1 Cr). API field name is legacy `logistics_cost_musd`. */
    logistics_cost_musd: number;
    co2_tonnes: number;
    workflow_completion_rate: number;
  };
  role_kpis: string[];
};

// Legacy type exports kept for compatibility with existing components.
export type KpiMetric = { label: string; value: string; change_pct: number | null; trend: string; polarity?: string };
export type MapSite = { id: string; name: string; site_type: string; latitude: number; longitude: number };
export type DisruptionRisk = { title: string; category: string; severity: string; probability: number; affected_site: string | null };
export type SupplyDisruptionAlert = { detection_type: string; headline: string; severity: string; probability: number; detail: string; horizon_days: number | null };
export type IndiaCityWire = {
  id: string;
  display_name: string;
  state: string;
  latitude: number;
  longitude: number;
  region: string;
  hub_type: string;
};

export type RouteDashboardLocation = { id: string; name: string; location_type: string; longitude: number; latitude: number };
export type RouteDashboardRoute = { id: string; label: string; coordinates: number[][]; duration_hours: number; cost_inr: number; co2_kg: number; is_best: boolean; distance_km: number };
export type KPISnapshot = { service_level_pct: number; cost_crore_inr: number; delay_shipments: number; co2_tonnes: number };

export type RouteMode = "road" | "rail" | "air" | "sea" | "multimodal";

export type RouteRecommendationRequest = {
  source_location: string;
  destination_location: string;
  shipment_quantity: number;
  priority: "Low" | "Medium" | "High" | "Critical";
  shipment_type: string;
  delivery_deadline?: string | null;
  preferred_mode?: RouteMode | null;
  carrier_constraints?: string[];
  co2_preference?: number;
  cost_preference?: number;
};

export type RouteRecommendationItem = {
  route_code: string;
  source_location: string;
  destination_location: string;
  mode: RouteMode;
  carrier_suggestion: string;
  eta_hours: number;
  distance_km: number;
  /** Route transport cost in Indian Rupees (₹). API field name is legacy `cost_usd`. */
  cost_usd: number;
  co2_kg: number;
  delay_probability: number;
  delay_risk: string;
  disruption_probability: number;
  disruption_risk: string;
  reliability: number;
  capacity_units: number;
  score: number;
  explanation: string;
  path_coordinates: Array<{ lat: number; lng: number }>;
};

export type RouteRecommendationResponse = {
  inputs: Record<string, unknown>;
  best_route: RouteRecommendationItem;
  alternates: RouteRecommendationItem[];
};

export type LiveTrackingResponse = {
  shipment_id: string;
  status: string;
  progress_percent: number;
  eta: string;
  current_position: { lat: number; lng: number };
  checkpoints: Array<{ name: string; status: "passed" | "current" | "upcoming" }>;
};

export type WorkflowTaskItem = {
  task_key: string;
  stage: WorkflowStage;
  task_name: string;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by_user_id: number | null;
  completed_by_name: string | null;
  can_edit: boolean;
};

export type WorkflowTasksResponse = {
  workflow_id: string;
  current_stage: WorkflowStage;
  current_role: UserRole;
  tasks: WorkflowTaskItem[];
};

export const api = {
  login: (email: string, password: string) => request<LoginResponse>("/auth/login", "POST", undefined, { email, password }),
  me: (token: string) => request<AuthUser>("/auth/me", "GET", token),
  logout: (token: string) => request<{ message: string }>("/auth/logout", "POST", token),
  dashboardSummaryByRole: (token: string, role: UserRole) => request<DashboardSummaryResponse>(`/dashboards/${role}/summary`, "GET", token),
  workflows: (token: string) => request<Workflow[]>("/workflows", "GET", token),
  pendingTasks: (token: string) => request<Workflow[]>("/workflows/pending", "GET", token),
  workflowById: (token: string, workflowId: string) => request<Workflow>(`/workflows/${workflowId}`, "GET", token),
  workflowTimeline: (token: string, workflowId: string) => request<WorkflowUpdate[]>(`/workflows/${workflowId}/timeline`, "GET", token),
  workflowShipmentDetails: (token: string, workflowId: string) => request<WorkflowShipmentDetails>(`/workflows/${workflowId}/shipment`, "GET", token),
  workflowAudit: (token: string, workflowId: string) => request<AuditLogItem[]>(`/workflows/${workflowId}/audit`, "GET", token),
  workflowTasks: (token: string, workflowId: string) => request<WorkflowTasksResponse>(`/workflows/${workflowId}/tasks`, "GET", token),
  updateWorkflowTask: (token: string, workflowId: string, taskKey: string, completed: boolean) =>
    request<WorkflowTaskItem>(`/workflows/${workflowId}/tasks/${encodeURIComponent(taskKey)}`, "PATCH", token, { completed }),
  addWorkflowRemark: (token: string, workflowId: string, remark: string) => request(`/workflows/${workflowId}/remark`, "POST", token, { remark }),
  updateWorkflowStatus: (token: string, workflowId: string, status: WorkflowStatus, remark: string) =>
    request<Workflow>(`/workflows/${workflowId}/status`, "PATCH", token, { status, remark }),
  completeWorkflowStage: (token: string, workflowId: string, remark: string) =>
    request<Workflow>(`/workflows/${workflowId}/complete`, "POST", token, { remark }),
  notifications: (token: string) => request<NotificationItem[]>("/notifications", "GET", token),
  unreadNotificationCount: (token: string) => request<{ unread: number }>("/notifications/unread-count", "GET", token),
  markAllNotificationsRead: (token: string) => request<{ updated: number }>("/notifications/read-all", "POST", token),
  markNotificationRead: (token: string, id: number) => request<NotificationItem>(`/notifications/${id}/read`, "POST", token),
  auditTrail: (token: string, query?: AuditTrailQuery) => {
    const qs = new URLSearchParams();
    if (query?.role) qs.set("role", query.role);
    if (query?.workflow_id) qs.set("workflow_id", query.workflow_id);
    if (query?.start) qs.set("start", query.start);
    if (query?.end) qs.set("end", query.end);
    if (query?.action_type) qs.set("action_type", query.action_type);
    if (query?.module_name) qs.set("module_name", query.module_name);
    if (typeof query?.limit === "number") qs.set("limit", String(query.limit));
    if (typeof query?.offset === "number") qs.set("offset", String(query.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<AuditTrailItem[]>(`/audit-trail${suffix}`, "GET", token);
  },
  forecast: (token: string) => request("/forecast", "GET", token),
  inventoryInsights: (token: string) => request("/inventory-insights", "GET", token),
  supplierRisk: (token: string) => request("/supplier-risk", "GET", token),
  scenario: (token: string, scenario: string) => request("/scenario-simulation", "POST", token, { scenario }),
  routeRecommendations: (token: string, source: string, destination: string) =>
    request<RouteRecommendationResponse>("/route-recommendations", "POST", token, { source, destination }),
  recommendRoute: (token: string, payload: RouteRecommendationRequest) =>
    request<RouteRecommendationResponse>("/route-recommendations", "POST", token, payload),
  selectRouteForWorkflow: (token: string, workflowId: string, routeCode: string) =>
    request<{ workflow_id: string; shipment_id: string; selected_route_code: string }>(`/workflows/${workflowId}/routes/select`, "POST", token, { route_code: routeCode }),
  rerouteForWorkflow: (token: string, workflowId: string) =>
    request<RouteRecommendationResponse>(`/workflows/${workflowId}/routes/reroute`, "POST", token, { disruption_event: "map_reroute", force: true }),
  liveTracking: (token: string, shipmentId: string) => request<LiveTrackingResponse>(`/shipments/live-tracking/${shipmentId}`, "GET", token),
  indiaCitiesReference: (token: string) => request<IndiaCityWire[]>("/reference/india-cities", "GET", token),
};
