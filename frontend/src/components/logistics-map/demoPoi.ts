import type { IndiaCityRef } from "../../lib/indiaCitiesLookup";
import { resolveIndiaCoordinates } from "../../lib/indiaCitiesLookup";

export type PoiKind = "source" | "destination" | "warehouse" | "supplier" | "disruption" | "checkpoint" | "shipment";

export type Poi = {
  id: string;
  kind: PoiKind;
  name: string;
  lat: number;
  lng: number;
  detail?: string;
  severity?: "low" | "medium" | "high" | "critical";
};

// Demo coordinates (India) for enterprise logistics POV.
export const demoGeo: Record<string, { lat: number; lng: number }> = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  "Mumbai DC": { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  "Delhi WH-01": { lat: 28.7041, lng: 77.1025 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  "Chennai WH-07": { lat: 13.0674, lng: 80.2376 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  "Pune WH-02": { lat: 18.59, lng: 73.78 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  "Bengaluru WH-03": { lat: 12.985, lng: 77.64 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  "Kolkata WH-04": { lat: 22.62, lng: 88.39 },
  Nagpur: { lat: 21.1458, lng: 79.0882 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Indore: { lat: 22.7196, lng: 75.8577 },
};

export function geocode(name: string, indiaCities?: IndiaCityRef[]): { lat: number; lng: number } {
  if (indiaCities?.length) {
    const hit = resolveIndiaCoordinates(name, indiaCities);
    if (hit) return { lat: hit.lat, lng: hit.lng };
  }
  const key = Object.keys(demoGeo).find((k) => k.toLowerCase() === name.trim().toLowerCase());
  if (key) return demoGeo[key];
  const partial = Object.keys(demoGeo).find((k) => name.toLowerCase().includes(k.toLowerCase()));
  if (partial) return demoGeo[partial];
  return { lat: 20.5937, lng: 78.9629 };
}

export function buildWarehousePois(): Poi[] {
  return [
    { id: "wh-del", kind: "warehouse", name: "Delhi WH-01", ...demoGeo["Delhi WH-01"], detail: "Primary North DC" },
    { id: "wh-che", kind: "warehouse", name: "Chennai WH-07", ...demoGeo["Chennai WH-07"], detail: "South region fulfillment" },
    { id: "wh-pun", kind: "warehouse", name: "Pune WH-02", ...demoGeo["Pune WH-02"], detail: "West crossdock" },
    { id: "wh-blr", kind: "warehouse", name: "Bengaluru WH-03", ...demoGeo["Bengaluru WH-03"], detail: "South buffer facility" },
    { id: "wh-kol", kind: "warehouse", name: "Kolkata WH-04", ...demoGeo["Kolkata WH-04"], detail: "East hub" },
  ];
}

export function buildSupplierPois(): Poi[] {
  return [
    { id: "sup-apex", kind: "supplier", name: "Apex Components", ...demoGeo.Pune, detail: "Electronics components supplier" },
    { id: "sup-nova", kind: "supplier", name: "Nova Plastics", ...demoGeo.Ahmedabad, detail: "Packaging supplier" },
    { id: "sup-green", kind: "supplier", name: "GreenLine Metals", ...demoGeo.Delhi, detail: "Metals supplier" },
    { id: "sup-orchid", kind: "supplier", name: "Orchid Electronics", ...demoGeo.Kolkata, detail: "PCB supplier" },
  ];
}

