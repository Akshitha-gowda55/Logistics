import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveTrackingResponse, RouteRecommendationItem } from "../../lib/api";
import { formatInr } from "../../lib/formatCurrency";
import type { Poi } from "./demoPoi";

function FixLeafletIcons() {
  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }, []);
  return null;
}

function FitBounds({ points }: { points: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

function colorFor(kind: Poi["kind"]): string {
  switch (kind) {
    case "source":
      return "#38bdf8";
    case "destination":
      return "#34d399";
    case "warehouse":
      return "#a78bfa";
    case "supplier":
      return "#fbbf24";
    case "disruption":
      return "#fb7185";
    case "checkpoint":
      return "#94a3b8";
    case "shipment":
      return "#60a5fa";
    default:
      return "#94a3b8";
  }
}

function severityRadius(sev?: string): number {
  const s = (sev ?? "low").toLowerCase();
  if (s.includes("critical")) return 10;
  if (s.includes("high")) return 9;
  if (s.includes("medium")) return 8;
  return 7;
}

/** Matches backend `workflow_system._latlng_along_path` (fractional index along polyline vertices). */
function latLngAlongPath(coords: Array<{ lat: number; lng: number }>, progressPct: number): { lat: number; lng: number } {
  const n = coords.length;
  if (n < 1) return { lat: 20.5937, lng: 78.9629 };
  if (n < 2) return { lat: coords[0].lat, lng: coords[0].lng };
  const f = (Math.max(0, Math.min(100, progressPct)) / 100) * (n - 1);
  const i = Math.floor(f);
  const t = f - i;
  if (i >= n - 1) return { lat: coords[n - 1].lat, lng: coords[n - 1].lng };
  const la = coords[i].lat;
  const ln = coords[i].lng;
  const lb = coords[i + 1].lat;
  const lc = coords[i + 1].lng;
  return { lat: la + (lb - la) * t, lng: ln + (lc - ln) * t };
}

function splitPolyline(coords: Array<{ lat: number; lng: number }>, progress: number) {
  if (coords.length < 2) return { completed: coords, active: [], upcoming: [] };
  const pct = Math.max(0, Math.min(100, progress));
  const n = coords.length;
  const f = (pct / 100) * (n - 1);
  const i = Math.floor(f);
  const t = f - i;
  const here = latLngAlongPath(coords, pct);
  const completed = [...coords.slice(0, i + 1)];
  if (t > 1e-6 && i < n - 1) completed.push(here);
  const active =
    t > 1e-6 && i < n - 1
      ? [coords[i], here, coords[i + 1]]
      : i > 0
        ? [coords[i - 1], coords[i]]
        : [coords[0], coords[1]];
  const upcoming = t > 1e-6 && i < n - 1 ? [here, ...coords.slice(i + 1)] : coords.slice(i);
  return { completed, active, upcoming };
}

function buildCheckpointMarkers(
  routeCoords: Array<{ lat: number; lng: number }>,
  checkpoints: LiveTrackingResponse["checkpoints"],
): Array<{ id: string; name: string; status: "passed" | "current" | "upcoming"; lat: number; lng: number }> {
  if (!routeCoords.length || !checkpoints.length) return [];
  const passed = checkpoints.filter((c) => c.status === "passed");
  const current = checkpoints.find((c) => c.status === "current");
  const upcoming = checkpoints.filter((c) => c.status === "upcoming");

  const n = checkpoints.length;
  const idxFor = (k: number) => Math.max(0, Math.min(routeCoords.length - 1, Math.round((k / Math.max(1, n - 1)) * (routeCoords.length - 1))));

  const out: Array<{ id: string; name: string; status: "passed" | "current" | "upcoming"; lat: number; lng: number }> = [];
  let p = 0;
  for (const c of passed) {
    const i = idxFor(p);
    out.push({ id: `cp-${c.name}`, name: c.name, status: "passed", lat: routeCoords[i].lat, lng: routeCoords[i].lng });
    p += 1;
  }

  if (current) {
    const i = idxFor(Math.min(passed.length, n - 1));
    out.push({ id: `cp-${current.name}`, name: current.name, status: "current", lat: routeCoords[i].lat, lng: routeCoords[i].lng });
  }

  let uIndexBase = Math.min(passed.length + 1, n - 1);
  for (let j = 0; j < upcoming.length; j++) {
    const i = idxFor(uIndexBase + j);
    out.push({ id: `cp-${upcoming[j].name}`, name: upcoming[j].name, status: "upcoming", lat: routeCoords[i].lat, lng: routeCoords[i].lng });
  }

  return out;
}

function checkpointStyle(status: "passed" | "current" | "upcoming") {
  if (status === "passed") return { color: "#94a3b8", fill: "#94a3b8", opacity: 0.65, radius: 6 };
  if (status === "current") return { color: "#f97316", fill: "#f97316", opacity: 0.9, radius: 8 };
  return { color: "#38bdf8", fill: "#38bdf8", opacity: 0.75, radius: 7 };
}

function AnimatedShipmentMarker({ position }: { position: { lat: number; lng: number } }) {
  const [pos, setPos] = useState(position);
  const prev = useRef(position);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    const to = position;
    prev.current = position;

    if (raf.current) cancelAnimationFrame(raf.current);
    const start = performance.now();
    const duration = 900;

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setPos({
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      });
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [position.lat, position.lng]);

  return (
    <Marker position={[pos.lat, pos.lng]}>
      <Popup>
        <div className="text-slate-900">
          <p className="font-semibold">Live Shipment Position</p>
          <p className="text-xs text-slate-700">Moving to latest GPS point.</p>
        </div>
      </Popup>
    </Marker>
  );
}

export function LogisticsMapPanel({
  best,
  alternates,
  selectedRouteCode,
  pois,
  tracking,
}: {
  best: RouteRecommendationItem | null;
  alternates: RouteRecommendationItem[];
  selectedRouteCode: string;
  pois: Poi[];
  tracking: LiveTrackingResponse | null;
}) {
  const selected =
    best?.route_code === selectedRouteCode
      ? best
      : alternates.find((a) => a.route_code === selectedRouteCode) ?? best;

  const fitBoundsPoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number }> = [];
    const pushPath = (path: Array<{ lat: number; lng: number }> | undefined) => {
      if (!path?.length) return;
      for (const p of path) pts.push(p);
    };
    // Tight fit on the route the user is comparing; include alternates so other options stay in view.
    pushPath(selected?.path_coordinates);
    pushPath(best?.path_coordinates);
    for (const a of alternates) pushPath(a.path_coordinates);
    for (const p of pois) pts.push({ lat: p.lat, lng: p.lng });
    if (tracking) pts.push({ lat: tracking.current_position.lat, lng: tracking.current_position.lng });
    return pts;
  }, [selected?.path_coordinates, best?.path_coordinates, alternates, pois, tracking]);

  const mapCenter: [number, number] = useMemo(() => {
    const path = selected?.path_coordinates;
    if (path?.length) {
      const mid = path[Math.floor(path.length / 2)];
      return [mid.lat, mid.lng];
    }
    if (fitBoundsPoints.length) {
      const m = fitBoundsPoints[Math.floor(fitBoundsPoints.length / 2)];
      return [m.lat, m.lng];
    }
    return [20.5937, 78.9629];
  }, [selected?.path_coordinates, fitBoundsPoints]);

  const progress = tracking?.progress_percent ?? 0;
  const selectedSplit = selected?.path_coordinates ? splitPolyline(selected.path_coordinates, progress) : null;
  const checkpointMarkers = useMemo(() => {
    if (!tracking || !selected?.path_coordinates?.length) return [];
    return buildCheckpointMarkers(selected.path_coordinates, tracking.checkpoints);
  }, [tracking, selected?.route_code, selected?.path_coordinates?.length]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl">
      <div className="h-[520px] w-full">
        <MapContainer center={mapCenter} zoom={5} className="h-full w-full" scrollWheelZoom>
          <FixLeafletIcons />
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={fitBoundsPoints} />

          {/* Alternate route polylines */}
          {alternates.map((r) => (
            <Polyline
              key={r.route_code}
              positions={(r.path_coordinates ?? []).map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color: r.route_code === selectedRouteCode ? "#fbbf24" : "#64748b",
                weight: r.route_code === selectedRouteCode ? 4 : 3,
                opacity: r.route_code === selectedRouteCode ? 0.75 : 0.45,
              }}
            >
              <Popup>
                <div className="text-slate-900">
                  <p className="font-semibold">{r.route_code} (Other)</p>
                  <p className="text-xs text-slate-700">
                    ETA {r.eta_hours.toFixed(1)}h · {r.distance_km.toFixed(0)} km · {formatInr(r.cost_usd)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{r.explanation}</p>
                </div>
              </Popup>
            </Polyline>
          ))}

          {/* Best route polyline */}
          {best?.path_coordinates?.length ? (
            <Polyline
              positions={best.path_coordinates.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color: "#22c55e",
                weight: 5,
                opacity: 0.85,
              }}
            >
              <Popup>
                <div className="text-slate-900">
                  <p className="font-semibold">{best.route_code} (Best)</p>
                  <p className="text-xs text-slate-700">
                    ETA {best.eta_hours.toFixed(1)}h · {best.distance_km.toFixed(0)} km · {formatInr(best.cost_usd)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{best.explanation}</p>
                </div>
              </Popup>
            </Polyline>
          ) : null}

          {/* Completed vs active segment for selected route */}
          {selectedSplit ? (
            <>
              <Polyline
                positions={selectedSplit.completed.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: "#60a5fa", weight: 6, opacity: 0.9 }}
              />
              <Polyline
                positions={selectedSplit.active.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: "#f97316", weight: 7, opacity: 0.95 }}
              />
            </>
          ) : null}

          {/* Checkpoint markers along selected route */}
          {checkpointMarkers.map((c) => {
            const s = checkpointStyle(c.status);
            return (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lng]}
                radius={s.radius}
                pathOptions={{ color: s.color, fillColor: s.fill, fillOpacity: s.opacity, weight: 2 }}
              >
                <LeafletTooltip direction="top" offset={[0, -8]} opacity={0.9}>
                  {c.name} · {c.status}
                </LeafletTooltip>
                <Popup>
                  <div className="text-slate-900">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-700">Checkpoint status: {c.status}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Points of interest */}
          {pois.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={p.kind === "disruption" ? severityRadius(p.severity) : 7}
              pathOptions={{ color: colorFor(p.kind), fillColor: colorFor(p.kind), fillOpacity: 0.9, weight: 2 }}
            >
              <LeafletTooltip direction="top" offset={[0, -8]} opacity={0.9}>
                {p.name}
              </LeafletTooltip>
              <Popup>
                <div className="text-slate-900">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs capitalize text-slate-600">{p.kind.replace("_", " ")}</p>
                  {p.detail ? <p className="mt-1 text-xs text-slate-700">{p.detail}</p> : null}
                  {p.severity ? <p className="mt-1 text-xs text-slate-700">Level: {p.severity}</p> : null}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Live shipment marker */}
          {tracking ? <AnimatedShipmentMarker position={tracking.current_position} /> : null}
        </MapContainer>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
        <LegendDot color="#22c55e" label="Best route" />
        <LegendDot color="#64748b" label="Other route" />
        <LegendDot color="#60a5fa" label="Done part" />
        <LegendDot color="#f97316" label="Current part" />
        <LegendDot color="#94a3b8" label="Passed checkpoint" />
        <LegendDot color="#38bdf8" label="Next checkpoint" />
        <LegendDot color="#fb7185" label="Problem" />
        <LegendDot color="#a78bfa" label="Warehouse" />
        <LegendDot color="#fbbf24" label="Supplier" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

