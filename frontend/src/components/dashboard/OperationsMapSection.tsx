import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api, type IndiaCityWire, RouteRecommendationRequest, RouteRecommendationResponse, Workflow, type LiveTrackingResponse } from "../../lib/api";
import type { IndiaCityRef } from "../../lib/indiaCitiesLookup";
import { LogisticsMapPanel } from "../logistics-map/LogisticsMapPanel";
import { RouteSearchForm } from "../logistics-map/RouteSearchForm";
import { RouteRecommendationCard } from "../logistics-map/RouteRecommendationCard";
import { AlternateRoutesPanel } from "../logistics-map/AlternateRoutesPanel";
import { LiveTrackingWidget } from "../logistics-map/LiveTrackingWidget";
import { buildSupplierPois, buildWarehousePois, geocode, type Poi } from "../logistics-map/demoPoi";

/** Leaflet logistics map embedded on the Operations Control Tower dashboard. */
export function OperationsMapSection() {
  const { token } = useAuth();
  const [firstShipment, setFirstShipment] = useState<string>("");
  const [firstWorkflow, setFirstWorkflow] = useState<string>("");

  const [indiaCities, setIndiaCities] = useState<IndiaCityWire[]>([]);
  const cityRefList: IndiaCityRef[] = useMemo(
    () =>
      indiaCities.map((c) => ({
        id: c.id,
        display_name: c.display_name,
        state: c.state,
        latitude: c.latitude,
        longitude: c.longitude,
        region: c.region,
        hub_type: c.hub_type,
      })),
    [indiaCities],
  );

  const [request, setRequest] = useState<RouteRecommendationRequest>({
    source_location: "Bengaluru",
    destination_location: "Chennai",
    shipment_quantity: 800,
    priority: "High",
    shipment_type: "electronics",
    delivery_deadline: null,
    preferred_mode: null,
    carrier_constraints: [],
    co2_preference: 0.35,
    cost_preference: 0.45,
  });

  const [working, setWorking] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState("");
  const [routes, setRoutes] = useState<RouteRecommendationResponse | null>(null);
  const [selectedRouteCode, setSelectedRouteCode] = useState<string>("");
  const [tracking, setTracking] = useState<LiveTrackingResponse | null>(null);

  useEffect(() => {
    if (!token) return;
    void api
      .indiaCitiesReference(token)
      .then(setIndiaCities)
      .catch(() => setIndiaCities([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setBootLoading(true);
    setError("");
    Promise.all([api.pendingTasks(token), api.workflows(token)])
      .then(async ([pending, all]) => {
        const wf = ((pending as Workflow[])[0] ?? (all as Workflow[])[0]) as Workflow | undefined;
        if (!wf) return;
        setFirstShipment(wf.shipment_id);
        setFirstWorkflow(wf.item_name);
        setRequest((prev) => ({
          ...prev,
          source_location: wf.source_location || prev.source_location,
          destination_location: wf.destination_location || prev.destination_location,
          priority: wf.priority || prev.priority,
          delivery_deadline: wf.due_date ? new Date(wf.due_date).toISOString() : prev.delivery_deadline,
        }));
        const shipment = await api.workflowShipmentDetails(token, wf.item_name);
        if (shipment?.selected_route?.route_code) {
          setSelectedRouteCode(shipment.selected_route.route_code);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load map data"))
      .finally(() => setBootLoading(false));
  }, [token]);

  async function recommend() {
    if (!token) return;
    setWorking(true);
    setError("");
    try {
      const res = await api.recommendRoute(token, request);
      setRoutes(res);
      setSelectedRouteCode(res.best_route.route_code);
    } catch (e) {
      let msg = e instanceof Error ? e.message : "Could not find routes";
      try {
        const j = JSON.parse(msg);
        if (j?.detail?.message) msg = j.detail.message;
        else if (typeof j?.detail === "string") msg = j.detail;
      } catch {
        /* keep msg */
      }
      setError(msg);
    } finally {
      setWorking(false);
    }
  }

  async function selectRoute(routeCode: string) {
    if (!token || !firstWorkflow) {
      setError("You need at least one workflow assignment to attach a saved route.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await api.selectRouteForWorkflow(token, firstWorkflow, routeCode);
      setSelectedRouteCode(routeCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save route");
    } finally {
      setWorking(false);
    }
  }

  async function reroute() {
    if (!token || !firstWorkflow) {
      setError("Assign a workflow to use reroute (uses that shipment lane).");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const res = await api.rerouteForWorkflow(token, firstWorkflow);
      setRoutes(res);
      setSelectedRouteCode(res.best_route.route_code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find new route");
    } finally {
      setWorking(false);
    }
  }

  const pois = useMemo(() => {
    const src = geocode(request.source_location, cityRefList);
    const dst = geocode(request.destination_location, cityRefList);
    const base: Poi[] = [
      { id: "src", kind: "source", name: request.source_location, lat: src.lat, lng: src.lng, detail: "Pickup point" },
      { id: "dst", kind: "destination", name: request.destination_location, lat: dst.lat, lng: dst.lng, detail: "Drop point" },
      ...buildWarehousePois(),
      ...buildSupplierPois(),
    ];

    const selected =
      routes?.best_route?.route_code === selectedRouteCode
        ? routes?.best_route
        : routes?.alternates.find((a) => a.route_code === selectedRouteCode) ?? routes?.best_route;

    if (selected?.path_coordinates?.length) {
      const mid = selected.path_coordinates[Math.floor(selected.path_coordinates.length / 2)];
      if (selected.disruption_probability >= 0.22) {
        base.push({
          id: "disruption-1",
          kind: "disruption",
          name: "Problem found",
          lat: mid.lat,
          lng: mid.lng,
          severity: selected.disruption_probability >= 0.45 ? "high" : "medium",
          detail: `Problem chance ${Math.round(selected.disruption_probability * 100)}%`,
        });
      }
    }
    return base;
  }, [request.source_location, request.destination_location, routes, selectedRouteCode, tracking, cityRefList]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,420px),1fr]">
      <div className="space-y-4">
        <RouteSearchForm
          value={request}
          onChange={setRequest}
          onSubmit={() => void recommend()}
          working={working}
          indiaCities={indiaCities}
        />

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs text-rose-100">{error}</div>
        ) : null}

        {bootLoading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">Loading map data…</div>
        ) : routes ? (
          <>
            <div className="flex flex-wrap gap-2">
              {firstWorkflow ? (
                <button
                  type="button"
                  onClick={() => void reroute()}
                  disabled={working}
                  className="rounded-full bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {working ? "Working…" : "Find New Route"}
                </button>
              ) : null}
              <span className="text-xs text-slate-400 self-center">Leaflet routes: pick best vs eco/alternate lanes.</span>
            </div>

            <RouteRecommendationCard
              route={routes.best_route}
              badge="Best"
              onSelect={() => void selectRoute(routes.best_route.route_code)}
            />

            <AlternateRoutesPanel
              routes={routes.alternates}
              selectedRouteCode={selectedRouteCode}
              onSelect={(code) => void selectRoute(code)}
            />
          </>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
            Choose cities and tap <span className="font-semibold text-slate-200">Find Best Route</span>.
          </div>
        )}

        {firstShipment ? (
          <LiveTrackingWidget shipmentId={firstShipment} syncKey={selectedRouteCode} onTracking={(t) => setTracking(t)} />
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">Route map</p>
              <p className="mt-1 text-xs text-slate-400">Source / destination pins and corridor polyline (React Leaflet).</p>
            </div>
            <div className="text-xs text-slate-400">
              <span className="font-mono text-slate-200">{firstWorkflow || "—"}</span> · {firstShipment || "—"}
            </div>
          </div>
        </div>

        <LogisticsMapPanel
          best={routes?.best_route ?? null}
          alternates={routes?.alternates ?? []}
          selectedRouteCode={selectedRouteCode}
          pois={pois}
          tracking={tracking}
        />
      </div>
    </div>
  );
}
