export type IndiaCityRef = {
  id: string;
  display_name: string;
  state: string;
  latitude: number;
  longitude: number;
  region: string;
  hub_type: string;
};

function stripLogisticsNoise(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s*wh[- ]?\d*/gi, "")
    .replace(/\s*dc\d*/gi, "")
    .replace(/\s*hub\b/gi, "")
    .replace(/\s*mega\s*/g, " ")
    .replace(/\s*warehouse\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve user-entered location to coordinates using the India reference list. */
export function resolveIndiaCoordinates(query: string, cities: IndiaCityRef[]): { lat: number; lng: number; label: string } | null {
  if (!cities.length) return null;
  const q = stripLogisticsNoise(query);
  if (!q) return null;
  const byId = cities.find((c) => c.id.toLowerCase() === q);
  if (byId) return { lat: byId.latitude, lng: byId.longitude, label: byId.display_name };
  const exact = cities.find((c) => c.display_name.toLowerCase() === q);
  if (exact) return { lat: exact.latitude, lng: exact.longitude, label: exact.display_name };
  const first = q.split(/\s+/)[0];
  const pref = cities.find((c) => c.id.toLowerCase() === first || c.display_name.toLowerCase().startsWith(first));
  if (pref) return { lat: pref.latitude, lng: pref.longitude, label: pref.display_name };
  let best: IndiaCityRef | null = null;
  let bestLen = 0;
  for (const c of cities) {
    const n = c.display_name.toLowerCase();
    if (q.includes(n) || n.includes(q)) {
      if (n.length > bestLen) {
        best = c;
        bestLen = n.length;
      }
    }
  }
  if (best) return { lat: best.latitude, lng: best.longitude, label: best.display_name };
  return null;
}
