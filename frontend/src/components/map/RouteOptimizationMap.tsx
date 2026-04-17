import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Source } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { RouteDashboardLocation, RouteDashboardRoute } from "../../lib/api";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

const INDIA_VIEW = { longitude: 78.5, latitude: 20.5, zoom: 4.65 };

function routeColor(id: string, selectedId: string, bestId: string): string {
  if (id === selectedId) return id === bestId ? "#15803d" : "#2563eb";
  if (id === bestId) return "#22c55e";
  return "#94a3b8";
}

export function RouteOptimizationMap({
  token,
  locations,
  routes,
  selectedRouteId,
  bestRouteId,
  onSelectRoute,
}: {
  token: string;
  locations: RouteDashboardLocation[];
  routes: RouteDashboardRoute[];
  selectedRouteId: string;
  bestRouteId: string;
  onSelectRoute: (id: string) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [linesReady, setLinesReady] = useState(false);

  const sitesGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: locations.map((l) => ({
        type: "Feature" as const,
        properties: { name: l.name, kind: l.location_type },
        geometry: { type: "Point" as const, coordinates: [l.longitude, l.latitude] },
      })),
    }),
    [locations],
  );

  useEffect(() => {
    if (!mapReady) return;
    const t = window.setTimeout(() => setLinesReady(true), 100);
    return () => window.clearTimeout(t);
  }, [mapReady, routes]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady || routes.length === 0) return;
    const active = routes.find((x) => x.id === selectedRouteId) ?? routes[0];
    if (!active?.coordinates.length) return;
    const b = new mapboxgl.LngLatBounds();
    active.coordinates.forEach(([lng, lat]) => b.extend([lng, lat]));
    locations.forEach((l) => b.extend([l.longitude, l.latitude]));
    map.fitBounds(b, { padding: 72, maxZoom: 7, duration: 0 });
  }, [linesReady, locations, mapReady, routes, selectedRouteId]);

  const onLoad = () => setMapReady(true);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:min-h-[560px]">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={INDIA_VIEW}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        reuseMaps
        antialias={false}
        renderWorldCopies={false}
        onLoad={onLoad}
      >
        <Source
          id="sites"
          type="geojson"
          data={sitesGeoJson}
          cluster
          clusterMaxZoom={14}
          clusterRadius={52}
          clusterProperties={{}}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#bfdbfe",
              "circle-stroke-color": "#1d4ed8",
              "circle-stroke-width": 2,
              "circle-radius": ["step", ["get", "point_count"], 16, 6, 20, 12, 24],
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": "{point_count_abbreviated}",
              "text-size": 11,
            }}
            paint={{ "text-color": "#0f172a" }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": [
                "match",
                ["get", "kind"],
                "supplier",
                "#2563eb",
                "plant",
                "#16a34a",
                "warehouse",
                "#ea580c",
                "#64748b",
              ],
              "circle-radius": 7,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            }}
          />
          <Layer
            id="unclustered-label"
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{
              "text-field": ["get", "name"],
              "text-size": 10,
              "text-offset": [0, 1.35],
              "text-anchor": "top",
              "text-max-width": 14,
            }}
            paint={{
              "text-color": "#0f172a",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.2,
            }}
          />
        </Source>

        {linesReady &&
          routes.map((r) => {
            const selected = r.id === selectedRouteId;
            const opacity = routes.length <= 1 ? 0.9 : selected ? 0.95 : r.id === bestRouteId ? 0.62 : 0.28;
            const width = selected ? 4 : r.id === bestRouteId ? 3.2 : 2.4;
            const geojson = {
              type: "Feature" as const,
              properties: {},
              geometry: { type: "LineString" as const, coordinates: r.coordinates },
            };
            return (
              <Source key={r.id} id={`src-${r.id}`} type="geojson" data={geojson}>
                <Layer
                  id={`line-${r.id}`}
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{
                    "line-color": routeColor(r.id, selectedRouteId, bestRouteId),
                    "line-width": width,
                    "line-opacity": opacity,
                  }}
                />
              </Source>
            );
          })}
      </Map>

      {!mapReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-slate-600">
          Loading map…
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-3 max-w-[min(100%,320px)] rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur">
        <span className="font-medium text-slate-800">Legend: </span>
        supplier (blue) · plant (green) · warehouse (orange). Clusters group nearby sites. Polylines load after map
        idle for faster first paint.
      </div>

      <button
        type="button"
        className="absolute bottom-3 right-3 rounded-lg border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-800 shadow hover:bg-slate-50"
        onClick={() => {
          const idx = routes.findIndex((x) => x.id === selectedRouteId);
          const n = routes[(idx + 1) % routes.length];
          if (n) onSelectRoute(n.id);
        }}
      >
        Next route
      </button>
    </div>
  );
}
