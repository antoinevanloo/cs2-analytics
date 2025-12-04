"use client";

/**
 * Rating Trend - Chart showing rating history over time
 *
 * Displays a line/area chart of rating evolution with:
 * - Color-coded zones for rating tiers
 * - Trend indicator (improving/declining/stable)
 * - Average line reference
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RatingHistoryEntry {
  demoId: string;
  map: string;
  playedAt: string | null;
  score: string;
  rating: number;
  ratingLabel: string;
  kd: number;
  adr: number;
}

interface RatingTrendProps {
  history: RatingHistoryEntry[];
  statistics: {
    avgRating: number;
    minRating: number;
    maxRating: number;
    trend: number;
    trendLabel: string;
  };
  height?: number;
  className?: string;
}

/**
 * Get trend color and icon
 */
function getTrendDisplay(trend: number): {
  color: string;
  icon: string;
  label: string;
} {
  if (trend > 0.02) {
    return { color: "text-green-500", icon: "↑", label: "Improving" };
  }
  if (trend < -0.02) {
    return { color: "text-red-500", icon: "↓", label: "Declining" };
  }
  return { color: "text-muted-foreground", icon: "→", label: "Stable" };
}

/**
 * Custom tooltip for the chart
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RatingHistoryEntry & { matchNumber: number } }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-md">
      <p className="font-medium">{data.map}</p>
      <p className="text-sm text-muted-foreground">{data.score}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Rating: </span>
          <span className="font-medium">{data.rating.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">K/D: </span>
          <span className="font-medium">{data.kd.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">ADR: </span>
          <span className="font-medium">{data.adr.toFixed(0)}</span>
        </div>
        <div className="text-xs text-muted-foreground">{data.ratingLabel}</div>
      </div>
    </div>
  );
}

export function RatingTrend({
  history,
  statistics,
  height = 200,
  className,
}: RatingTrendProps) {
  const trendDisplay = getTrendDisplay(statistics.trend);

  // Prepare chart data - reverse to show oldest first
  const chartData = [...history].reverse().map((entry, index) => ({
    ...entry,
    matchNumber: index + 1,
  }));

  // Calculate Y-axis domain with some padding
  const yMin = Math.max(0.7, statistics.minRating - 0.1);
  const yMax = Math.min(1.5, statistics.maxRating + 0.1);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Rating Trend</CardTitle>
            <CardDescription>{history.length} matches analyzed</CardDescription>
          </div>
          <div className="text-right">
            <div className={cn("text-2xl font-bold", trendDisplay.color)}>
              {trendDisplay.icon} {statistics.trend >= 0 ? "+" : ""}
              {statistics.trend.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground">
              {trendDisplay.label}
            </p>
          </div>
        </div>

        {/* Statistics summary */}
        <div className="flex gap-4 pt-2 text-sm">
          <div>
            <span className="text-muted-foreground">Avg: </span>
            <span className="font-medium">
              {statistics.avgRating.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Min: </span>
            <span className="font-medium">
              {statistics.minRating.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Max: </span>
            <span className="font-medium">
              {statistics.maxRating.toFixed(2)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5D79AE" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#5D79AE" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="matchNumber"
              className="text-xs fill-muted-foreground"
              tickFormatter={(value) => `#${value}`}
            />
            <YAxis
              domain={[yMin, yMax]}
              className="text-xs fill-muted-foreground"
              tickFormatter={(value: number) => value.toFixed(2)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Average reference line */}
            <ReferenceLine
              y={1.0}
              stroke="#888"
              strokeDasharray="5 5"
              label={{
                value: "Avg",
                position: "left",
                className: "text-xs fill-muted-foreground",
              }}
            />

            {/* Good rating threshold */}
            <ReferenceLine
              y={1.1}
              stroke="#22C55E"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />

            <Area
              type="monotone"
              dataKey="rating"
              stroke="#5D79AE"
              strokeWidth={2}
              fill="url(#ratingGradient)"
              dot={{ fill: "#5D79AE", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#5D79AE" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export type { RatingHistoryEntry, RatingTrendProps };
