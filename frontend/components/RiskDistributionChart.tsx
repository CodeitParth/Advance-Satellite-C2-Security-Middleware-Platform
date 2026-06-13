"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS: Record<string, string> = {
  LOW:      "#22C55E",
  MEDIUM:   "#F59E0B",
  HIGH:     "#EF4444",
  CRITICAL: "#8B5CF6",
};

const DEMO_DATA = [
  { name: "LOW",      value: 14 },
  { name: "MEDIUM",   value: 8  },
  { name: "HIGH",     value: 4  },
  { name: "CRITICAL", value: 1  },
];

interface RiskDistributionChartProps {
  data?: { name: string; value: number }[];
}

export function RiskDistributionChart({ data = DEMO_DATA }: RiskDistributionChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold text-content-primary">Risk Distribution</h3>
        <span className="text-xs text-content-muted">Today</span>
      </div>
      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] ?? "#6B7280"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#1A2234",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#F9FAFB",
              }}
              formatter={(val: number) => [`${val} commands`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-content-primary">{total}</span>
          <span className="text-2xs text-content-muted">total</span>
        </div>
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs shrink-0" style={{ background: COLORS[entry.name] ?? "#6B7280" }} />
            <span className="text-xs text-content-muted">{entry.name}</span>
            <span className="text-xs font-semibold text-content-primary ml-auto">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
