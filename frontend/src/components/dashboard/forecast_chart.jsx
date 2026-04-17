import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const API = "/api/v1/forecast/chart";

const axis = { stroke: "#475569", fontSize: 11 };
const grid = { stroke: "#1e293b" };

/**
 * Merge history + forecast for Recharts (band = upper − lower on forecast rows only).
 * @param {{ history: { week: string; demand: number }[]; forecast: { week: string; predicted_demand: number; confidence: number; lower: number; upper: number }[] }} payload
 */
function mergeSeries(payload) {
  const rows = [];
  for (const h of payload.history) {
    rows.push({
      week: h.week,
      actual: h.demand,
      predicted: null,
      lowerBound: null,
      upperBound: null,
      confidence: null,
    });
  }
  for (const f of payload.forecast) {
    rows.push({
      week: f.week,
      actual: null,
      predicted: f.predicted_demand,
      lowerBound: f.lower,
      upperBound: f.upper,
      confidence: f.confidence,
    });
  }
  return rows;
}

function ForecastTooltip({ active, label, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 10px",
      }}
    >
      <div style={{ color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      {row.actual != null && <div style={{ color: "#e2e8f0" }}>Historical: {row.actual}</div>}
      {row.predicted != null && (
        <>
          <div style={{ color: "#93c5fd" }}>Predicted: {row.predicted}</div>
          {row.confidence != null && (
            <div style={{ color: "#86efac" }}>Confidence: {(row.confidence * 100).toFixed(1)}%</div>
          )}
          {row.lowerBound != null && row.upperBound != null && (
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
              Interval: {row.lowerBound} – {row.upperBound}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * LightGBM demand forecast chart (historical demand + plant + part + week → prediction + confidence).
 * @param {{ plant?: string; part?: string }} props
 */
export function ForecastChart({ plant = "FDH", part = "BRG-440C" }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [meta, setMeta] = useState({ model_version: "" });

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ plant, part, horizon_weeks: "8", history_weeks: "80" });
    fetch(`${API}?${q}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(mergeSeries(json));
          setMeta({ model_version: json.model_version });
          setErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Forecast failed");
      });
    return () => {
      cancelled = true;
    };
  }, [plant, part]);

  const chartData = useMemo(() => data ?? [], [data]);

  if (err) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
        Forecast unavailable ({err}). Ensure the API is running and LightGBM deps are installed.
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Loading LightGBM forecast…</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Plant <span className="font-mono text-slate-300">{plant}</span> · Part{" "}
          <span className="font-mono text-slate-300">{part}</span>
        </span>
        <span className="rounded border border-slate-800 bg-slate-950/60 px-2 py-0.5 font-mono text-[11px] text-slate-400">
          {meta.model_version}
        </span>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} vertical={false} />
            <XAxis dataKey="week" tick={axis} tickLine={false} axisLine={{ stroke: "#334155" }} interval="preserveStartEnd" />
            <YAxis
              tick={axis}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
              width={40}
            />
            <Tooltip content={<ForecastTooltip />} />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="lowerBound"
              name="Lower (confidence)"
              stroke="#475569"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="upperBound"
              name="Upper (confidence)"
              stroke="#475569"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
            <Line type="monotone" dataKey="actual" name="Historical demand" stroke="#94a3b8" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
            <Line type="monotone" dataKey="predicted" name="Predicted demand" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-500">
        Dashed lines are lower/upper prediction interval; confidence decays slightly by horizon. Features: demand lags,
        week cycle (sin/cos), plant &amp; part encodings.
      </p>
    </div>
  );
}
