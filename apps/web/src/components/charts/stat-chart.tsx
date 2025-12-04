"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface StatChartProps {
  data: Array<Record<string, unknown>>;
  type?: "area" | "bar" | "pie";
  dataKey: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
}

const COLORS = ["#5D79AE", "#DE9B35", "#22C55E", "#EF4444", "#8B5CF6"];

export function StatChart({
  data,
  type = "area",
  dataKey,
  xAxisKey = "name",
  color = "#5D79AE",
  height = 300,
}: StatChartProps) {
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={xAxisKey}
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xAxisKey} className="text-xs fill-muted-foreground" />
          <YAxis className="text-xs fill-muted-foreground" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey={xAxisKey} className="text-xs fill-muted-foreground" />
        <YAxis className="text-xs fill-muted-foreground" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill={color}
          fillOpacity={0.2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Round-by-round performance chart
interface RoundPerformanceData {
  round: number;
  ctScore: number;
  tScore: number;
  kills?: number;
  damage?: number;
}

export function RoundPerformanceChart({
  data,
  height = 200,
}: {
  data: RoundPerformanceData[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="round" className="text-xs fill-muted-foreground" />
        <YAxis className="text-xs fill-muted-foreground" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="ctScore" fill="#5D79AE" stackId="score" />
        <Bar dataKey="tScore" fill="#DE9B35" stackId="score" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Economy chart
interface EconomyData {
  round: number;
  ctMoney: number;
  tMoney: number;
  ctEquip: number;
  tEquip: number;
}

export function EconomyChart({
  data,
  height = 200,
}: {
  data: EconomyData[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="round" className="text-xs fill-muted-foreground" />
        <YAxis className="text-xs fill-muted-foreground" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Area
          type="monotone"
          dataKey="ctEquip"
          stroke="#5D79AE"
          fill="#5D79AE"
          fillOpacity={0.3}
          name="CT Equipment"
        />
        <Area
          type="monotone"
          dataKey="tEquip"
          stroke="#DE9B35"
          fill="#DE9B35"
          fillOpacity={0.3}
          name="T Equipment"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
