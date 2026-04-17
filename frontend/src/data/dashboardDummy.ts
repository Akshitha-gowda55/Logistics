/** Realistic dummy series for dashboard charts (manufacturing / automotive logistics). */

export type DemandPoint = {
  week: string;
  actual: number | null;
  forecast: number;
};

export const demandForecastSeries: DemandPoint[] = [
  { week: "W-12", actual: 11840, forecast: 11920 },
  { week: "W-11", actual: 12105, forecast: 12080 },
  { week: "W-10", actual: 11980, forecast: 12140 },
  { week: "W-9", actual: 12340, forecast: 12290 },
  { week: "W-8", actual: 12210, forecast: 12380 },
  { week: "W-7", actual: 12480, forecast: 12420 },
  { week: "W-6", actual: 12560, forecast: 12510 },
  { week: "W-5", actual: 12620, forecast: 12640 },
  { week: "W-4", actual: 12790, forecast: 12720 },
  { week: "W-3", actual: 12840, forecast: 12860 },
  { week: "W-2", actual: 12920, forecast: 12980 },
  { week: "W-1", actual: 13010, forecast: 13040 },
  { week: "W+0", actual: null, forecast: 13120 },
  { week: "W+1", actual: null, forecast: 13240 },
  { week: "W+2", actual: null, forecast: 13180 },
  { week: "W+3", actual: null, forecast: 13360 },
  { week: "W+4", actual: null, forecast: 13420 },
];

export const heatmapLocations = ["FDH", "BER", "MUC", "FRA", "PRG", "GNB"] as const;

export const heatmapSkus = ["BRG-440C", "GEA-9HP", "CVJ-12K", "SHF-A1", "EPS-77", "BSH-02"] as const;

/** Days of cover (0–42); higher = more buffer */
export const inventoryHeatmapValues: number[][] = [
  [18, 22, 14, 26, 11, 19],
  [24, 16, 28, 13, 21, 17],
  [12, 31, 9, 22, 18, 25],
  [27, 19, 21, 15, 30, 12],
  [16, 14, 33, 20, 17, 23],
  [21, 25, 16, 29, 14, 20],
];

export type ShipmentRow = {
  id: string;
  lane: string;
  mode: string;
  eta: string;
  progress: number;
  status: "on_track" | "at_risk" | "delayed";
};

export const shipmentRows: ShipmentRow[] = [
  { id: "SH-204881", lane: "FDH → BER", mode: "FTL", eta: "Apr 12 · 06:40", progress: 72, status: "on_track" },
  { id: "SH-204902", lane: "MUC → FRA", mode: "LTL", eta: "Apr 12 · 14:10", progress: 54, status: "on_track" },
  { id: "SH-204915", lane: "PRG → FDH", mode: "FTL", eta: "Apr 13 · 09:15", progress: 38, status: "at_risk" },
  { id: "SH-204920", lane: "GNB → BER", mode: "Intermodal", eta: "Apr 13 · 22:00", progress: 21, status: "on_track" },
  { id: "SH-204933", lane: "FDH → FRA", mode: "FTL", eta: "Apr 11 · 18:30", progress: 91, status: "delayed" },
  { id: "SH-204941", lane: "BER → MUC", mode: "LTL", eta: "Apr 14 · 11:45", progress: 12, status: "on_track" },
];

export type RiskAlert = {
  id: string;
  time: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
};

export const riskAlertsStatic: RiskAlert[] = [
  {
    id: "A-901",
    time: "08:12",
    severity: "high",
    title: "Port dwell exceeds SLA (Hamburg corridor)",
    detail: "Rolling 48h average +6.2h vs baseline · 6 active bookings",
  },
  {
    id: "A-902",
    time: "07:40",
    severity: "medium",
    title: "Carrier tender acceptance below target",
    detail: "North region · 84% vs 92% target · next wave closes 14:00",
  },
  {
    id: "A-903",
    time: "Yesterday",
    severity: "low",
    title: "Cold chain probe deviation (resolved)",
    detail: "GNB inbound · sensor variance 0.8°C · no product impact",
  },
];
