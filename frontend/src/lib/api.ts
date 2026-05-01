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
export type WorkflowStage =
  | "planning"
  | "operations"
  | "inventory"
  | "supplier_risk"
  | "closed"
  | "executive_planning"
  | "operations_dispatch"
  | "supplier_risk_check"
  | "inventory_allocation"
  | "delivery_completion"
  | "executive_review";

export type AuthUser = { id: number; name: string; email: string; role: UserRole };
export type LoginResponse = { access_token: string; token_type: "bearer"; user: AuthUser };

export type TimelineEntryWire = {
  time: string;
  role: string;
  action: string;
  remarks: string;
  source?: string;
  sync_status?: string;
};

export type DecisionInsight = {
  problem: string;
  impact: string;
  recommended_action: string;
  priority: "low" | "medium" | "high";
};

export type Workflow = {
  id: number;
  item_name: string;
  product_name?: string | null;
  route_name?: string | null;
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
  supplier_status?: string;
  route_status?: string;
  inventory_status?: string;
  /** Denormalized checklist flags; one row per shipment. */
  executive_completed?: boolean;
  supplier_completed?: boolean;
  operations_completed?: boolean;
  inventory_completed?: boolean;
  material_type?: string;
  quantity?: number | null;
  unit?: string;
  supplier_party_name?: string;
  supplier_party_location?: string;
  sync_version?: number;
  timeline?: TimelineEntryWire[];
};

export type NotificationItem = {
  id: number;
  message: string;
  type: "info" | "warning" | "critical" | "success";
  related_item_name: string;
  is_read: boolean;
  created_at: string;
};

export type WorkflowUpdate = {
  id: number;
  item_name: string;
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
  item_name?: string | null;
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
  item_name: string | null;
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
  item_name?: string;
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
  /** balanced | fast | eco when backend attached real road API */
  route_lane?: string | null;
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
  id: number;
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

export type ChecklistPatchResponse = {
  success: boolean;
  workflow_id: string;
  item_name: string;
  updated_role: string;
  field: string;
  completed: boolean;
  next_team: string;
  sync_version: number;
};

export type CreateRawMaterialBody = {
  item_name: string;
  material_type: string;
  quantity: number;
  unit: string;
  supplier_name: string;
  supplier_location: string;
  source_location: string;
  destination_location: string;
  required_date?: string | null;
  priority: "low" | "medium" | "high";
  remarks?: string;
  shipment_id?: string;
};

export type WorkflowTasksResponse = {
  item_name: string;
  /** Internal DB id — use with task id for stable checkbox keys. */
  workflow_id: number;
  current_stage: WorkflowStage;
  current_role: UserRole;
  sync_version: number;
  tasks: WorkflowTaskItem[];
};

export const api = {
  login: (email: string, password: string) => request<LoginResponse>("/auth/login", "POST", undefined, { email, password }),
  me: (token: string) => request<AuthUser>("/auth/me", "GET", token),
  logout: (token: string) => request<{ message: string }>("/auth/logout", "POST", token),
  dashboardSummaryByRole: (token: string, role: UserRole) => request<DashboardSummaryResponse>(`/dashboards/${role}/summary`, "GET", token),
  workflows: (token: string, opts?: { q?: string }) => {
    const qs = opts?.q?.trim() ? `?q=${encodeURIComponent(opts.q.trim())}` : "";
    return request<Workflow[]>(`/workflows${qs}`, "GET", token);
  },
  createWorkflow: (token: string, body: CreateRawMaterialBody) =>
    request<Workflow>("/workflows", "POST", token, {
      item_name: body.item_name,
      material_type: body.material_type,
      quantity: body.quantity,
      unit: body.unit,
      supplier_name: body.supplier_name,
      supplier_location: body.supplier_location,
      source_location: body.source_location,
      destination_location: body.destination_location,
      priority: body.priority,
      remarks: body.remarks ?? "",
      remark: body.remarks ?? "",
      shipment_id: body.shipment_id ?? "",
      required_date: body.required_date || null,
    }),
  patchWorkflowChecklist: (
    token: string,
    workflowRef: string,
    body: { role: string; field: string; completed: boolean; remarks?: string; expected_sync_version?: number | null }
  ) =>
    request<ChecklistPatchResponse>(`/workflows/${encodeURIComponent(workflowRef)}/checklist`, "PATCH", token, {
      role: body.role,
      field: body.field,
      completed: body.completed,
      remarks: body.remarks ?? "",
      expected_sync_version: body.expected_sync_version ?? null,
    }),
  pendingTasks: (token: string) => request<Workflow[]>("/workflows/pending", "GET", token),
  workflowByItemName: (token: string, itemName: string) =>
    request<Workflow>(`/workflows/${encodeURIComponent(itemName)}`, "GET", token),
  workflowTimeline: (token: string, itemName: string) =>
    request<WorkflowUpdate[]>(`/workflows/${encodeURIComponent(itemName)}/timeline`, "GET", token),
  workflowShipmentDetails: (token: string, itemName: string) =>
    request<WorkflowShipmentDetails>(`/workflows/${encodeURIComponent(itemName)}/shipment`, "GET", token),
  workflowAudit: (token: string, itemName: string) =>
    request<AuditLogItem[]>(`/workflows/${encodeURIComponent(itemName)}/audit`, "GET", token),
  workflowTasks: (token: string, itemName: string) =>
    request<WorkflowTasksResponse>(`/workflows/${encodeURIComponent(itemName)}/tasks`, "GET", token),
  updateWorkflowTask: (token: string, itemName: string, taskKey: string, completed: boolean, remarks?: string) =>
    request<WorkflowTaskItem>(
      `/workflows/${encodeURIComponent(itemName)}/tasks/${encodeURIComponent(taskKey)}`,
      "PATCH",
      token,
      { completed, remarks: remarks ?? "" }
    ),
  patchWorkflowStageStatus: (
    token: string,
    workflowRef: string,
    body: { stage: string; completed: boolean; remarks?: string }
  ) =>
    request<Workflow>(`/workflows/${encodeURIComponent(workflowRef)}/stage-status`, "PATCH", token, {
      stage: body.stage,
      completed: body.completed,
      remarks: body.remarks ?? "",
    }),
  addWorkflowRemark: (token: string, itemName: string, remark: string) =>
    request(`/workflows/${encodeURIComponent(itemName)}/remark`, "POST", token, { remark }),
  updateWorkflowStatus: (token: string, itemName: string, status: WorkflowStatus, remark: string) =>
    request<Workflow>(`/workflows/${encodeURIComponent(itemName)}/status`, "PATCH", token, { status, remark }),
  completeWorkflowStage: (token: string, itemName: string, remark: string) =>
    request<Workflow>(`/workflows/${encodeURIComponent(itemName)}/complete`, "POST", token, { remark }),
  notifications: (token: string) => request<NotificationItem[]>("/notifications", "GET", token),
  unreadNotificationCount: (token: string) => request<{ unread: number }>("/notifications/unread-count", "GET", token),
  markAllNotificationsRead: (token: string) => request<{ updated: number }>("/notifications/read-all", "POST", token),
  markNotificationRead: (token: string, id: number) => request<NotificationItem>(`/notifications/${id}/read`, "POST", token),
  auditTrail: (token: string, query?: AuditTrailQuery) => {
    const qs = new URLSearchParams();
    if (query?.role) qs.set("role", query.role);
    if (query?.item_name) qs.set("item_name", query.item_name);
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
  decision: (token: string, itemName?: string) => {
    const q = itemName ? `?item_name=${encodeURIComponent(itemName)}` : "";
    return request<DecisionInsight>(`/decision${q}`, "GET", token);
  },
  workflowControlTimeline: (token: string, itemName: string) =>
    request<TimelineEntryWire[]>(`/workflows/${encodeURIComponent(itemName)}/control-timeline`, "GET", token),
  patchRouteDomain: (token: string, itemName: string, body: { route_status: string; remark?: string }) =>
    request<Workflow>(`/workflows/${encodeURIComponent(itemName)}/control/route`, "PATCH", token, body),
  patchSupplierDomain: (token: string, itemName: string, body: { supplier_status: string; delay_reason?: string }) =>
    request<Workflow>(`/workflows/${encodeURIComponent(itemName)}/control/supplier`, "PATCH", token, body),
  patchInventoryDomain: (token: string, itemName: string, body: { inventory_status: string; reorder_requested?: boolean; remark?: string }) =>
    request<Workflow>(`/workflows/${encodeURIComponent(itemName)}/control/inventory`, "PATCH", token, body),
  inventoryInsights: (token: string) => request("/inventory-insights", "GET", token),
  supplierRisk: (token: string) => request("/supplier-risk", "GET", token),
  scenario: (token: string, scenario: string) => request("/scenario-simulation", "POST", token, { scenario }),
  routeRecommendations: (token: string, source: string, destination: string) =>
    request<RouteRecommendationResponse>("/route-recommendations", "POST", token, { source, destination }),
  recommendRoute: (token: string, payload: RouteRecommendationRequest) =>
    request<RouteRecommendationResponse>("/route-recommendations", "POST", token, payload),
  selectRouteForWorkflow: (token: string, itemName: string, routeCode: string) =>
    request<{ item_name: string; shipment_id: string; selected_route_code: string }>(
      `/workflows/${encodeURIComponent(itemName)}/routes/select`,
      "POST",
      token,
      { route_code: routeCode }
    ),
  rerouteForWorkflow: (token: string, itemName: string) =>
    request<RouteRecommendationResponse>(
      `/workflows/${encodeURIComponent(itemName)}/routes/reroute`,
      "POST",
      token,
      { disruption_event: "map_reroute", force: true }
    ),
  liveTracking: (token: string, shipmentId: string) => request<LiveTrackingResponse>(`/shipments/live-tracking/${shipmentId}`, "GET", token),
  indiaCitiesReference: (token: string) => request<IndiaCityWire[]>("/reference/india-cities", "GET", token),
};
