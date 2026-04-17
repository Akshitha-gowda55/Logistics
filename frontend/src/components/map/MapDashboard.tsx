import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapSite } from "../../lib/api";

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

function FitBounds({ sites }: { sites: MapSite[] }) {
  const map = useMap();
  useEffect(() => {
    if (sites.length === 0) return;
    const bounds = L.latLngBounds(sites.map((s) => [s.latitude, s.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, sites]);
  return null;
}

const typeColors: Record<string, string> = {
  plant: "#38bdf8",
  warehouse: "#a78bfa",
  supplier: "#fbbf24",
  customer: "#34d399",
  hub: "#94a3b8",
};

export function MapDashboard({ sites, routeLatLngs }: { sites: MapSite[]; routeLatLngs: [number, number][] }) {
  const center: [number, number] = [50.5, 10.5];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl">
      <div className="h-[420px] w-full sm:h-[520px]">
        <MapContainer center={center} zoom={6} className="h-full w-full" scrollWheelZoom>
          <FixLeafletIcons />
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds sites={sites} />
          {routeLatLngs.length > 1 && (
            <Polyline positions={routeLatLngs} pathOptions={{ color: "#60a5fa", weight: 4, opacity: 0.85 }} />
          )}
          {sites.map((s) => (
            <Marker key={s.id} position={[s.latitude, s.longitude]}>
              <Popup>
                <div className="text-slate-900">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs capitalize text-slate-600">{s.site_type}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-800 bg-slate-900/60 px-4 py-3">
        {["plant", "warehouse", "supplier", "customer"].map((t) => (
          <span key={t} className="inline-flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: typeColors[t] ?? "#94a3b8" }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
