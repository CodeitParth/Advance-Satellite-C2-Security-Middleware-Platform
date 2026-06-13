"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const DEMO_DATA = [
  { day: "Mon", count: 12 },
  { day: "Tue", count: 18 },
  { day: "Wed", count: 9  },
  { day: "Thu", count: 24 },
  { day: "Fri", count: 15 },
  { day: "Sat", count: 6  },
  { day: "Sun", count: 10 },
];

interface CommandVolumeChartProps {
  data?: { day: string; count: number }[];
}

export function CommandVolumeChart({ data = DEMO_DATA }: CommandVolumeChartProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold text-content-primary">Command Volume</h3>
        <span className="text-xs text-content-muted">Last 7 Days</span>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={18} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="day"
              tick={{ fill: "#6B7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6B7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1A2234",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#F9FAFB",
              }}
              cursor={{ fill: "rgba(79,107,255,0.08)" }}
              formatter={(val: number) => [val, "commands"]}
            />
            <Bar dataKey="count" fill="#4F6BFF" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
