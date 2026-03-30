import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  LabelList,
} from "recharts";

export type WidgetGraphType = "bar" | "line" | "area" | "pie" | "scatter";

export interface GraphConfig {
  x_axis: string;
  y_axis: string;
  agg_type: string;
  is_raw_data: boolean;
  is_sampled: boolean;
  variables?: Array<{
    name: string;
    default: string;
    type: string;
    description?: string;
  }>;
}

export interface GraphLayout {
  id: string;
  title: string;
  graph_type: WidgetGraphType;
  base_sql: string;
  config: GraphConfig;
}

export interface ChartPoint {
  x: string;
  y: number;
}

export interface WidgetCardData {
  layout: GraphLayout;
  points: ChartPoint[];
  error?: string;
}

interface GraphWidgetRendererProps {
  widget: WidgetCardData;
  height?: string;
}

const CHART_COLORS = [
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#4f46e5",
];

function compactNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function ChartContainer({ children, height = "h-64" }: { children: React.ReactNode, height?: string }) {
  return <div className={`w-full ${height}`}>{children}</div>;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-3 py-2 shadow-sm">
      <p className="text-xs text-text">{data.x}</p>
      <p className="text-xs text-text-muted">{compactNumber(data.y)}</p>
    </div>
  );
}

export default function GraphWidgetRenderer({
  widget,
  height,
}: GraphWidgetRendererProps) {
  const points = widget.points;
  const xAxisLabel = widget.layout.config.x_axis;
  const yAxisLabel = widget.layout.config.y_axis;
  const scatterPoints = points.map((point, index) => ({
    x: index + 1,
    y: point.y,
    label: point.x,
  }));

  if (widget.error) {
    return (
      <div className={`${height || "h-56"} w-full flex items-center justify-center rounded-xl border border-error/20 bg-error-light text-error text-sm px-4 text-center`}>
        {widget.error}
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className={`${height || "h-56"} w-full flex items-center justify-center rounded-xl border border-border bg-bg/40 text-text-muted text-sm px-4 text-center`}>
        No data returned for this widget.
      </div>
    );
  }

  switch (widget.layout.graph_type) {
    case "bar":
      return (
        <ChartContainer height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={points}
              margin={{ top: 10, right: 12, left: 10, bottom: 28 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis
                dataKey="x"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                label={{
                  value: xAxisLabel,
                  position: "insideBottom",
                  offset: -16,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={compactNumber}
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="y" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    case "line":
      return (
        <ChartContainer height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 10, right: 12, left: 10, bottom: 28 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis
                dataKey="x"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                label={{
                  value: xAxisLabel,
                  position: "insideBottom",
                  offset: -16,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={compactNumber}
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="y"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    case "area":
      return (
        <ChartContainer height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 10, right: 12, left: 10, bottom: 28 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis
                dataKey="x"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                label={{
                  value: xAxisLabel,
                  position: "insideBottom",
                  offset: -16,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={compactNumber}
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="y"
                stroke="#2563eb"
                fill="#2563eb33"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    case "pie":
      return (
        <ChartContainer height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Pie
                data={points}
                dataKey="y"
                nameKey="x"
                cx="50%"
                cy="50%"
                outerRadius={90}
                labelLine={false}
              >
                {points.map((point, index) => (
                  <Cell
                    key={`${point.x}-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
                <LabelList
                  dataKey="x"
                  position="inside"
                  fill="#ffffff"
                  fontSize={11}
                  formatter={(value) => String(value ?? "").slice(0, 10)}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    case "scatter":
      return (
        <ChartContainer height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 12, left: 10, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis
                dataKey="x"
                type="number"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                label={{
                  value: xAxisLabel,
                  position: "insideBottom",
                  offset: -16,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <YAxis
                dataKey="y"
                type="number"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={compactNumber}
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value, _name, item) => {
                  const numericValue =
                    typeof value === "number" ? value : Number(value ?? 0);
                  const label =
                    (item?.payload as { label?: string } | undefined)?.label ??
                    "point";
                  return [compactNumber(numericValue), label];
                }}
              />
              <Scatter data={scatterPoints} fill="#2563eb" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    default:
      return (
        <ChartContainer height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={points}
              margin={{ top: 10, right: 12, left: 10, bottom: 28 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis
                dataKey="x"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                label={{
                  value: xAxisLabel,
                  position: "insideBottom",
                  offset: -16,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={compactNumber}
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="y" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
  }
}
