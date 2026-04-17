import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemandPoint } from "../../data/dashboardDummy";

const axis = { stroke: "#475569", fontSize: 11 };
const grid = { stroke: "#1e293b" };

export function DemandForecastChart({ data }: { data: DemandPoint[] }) {
  const fillId = `fcFill-${useId().replace(/:/g, "")}`;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} vertical={false} />
          <XAxis dataKey="week" tick={axis} tickLine={false} axisLine={{ stroke: "#334155" }} />
          <YAxis
            tick={axis}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: 8 }} />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#3b82f6"
            fill={`url(#${fillId})`}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#94a3b8"
            strokeWidth={2}
            dot={{ r: 2, fill: "#94a3b8" }}
            connectNulls={false}
          />
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
