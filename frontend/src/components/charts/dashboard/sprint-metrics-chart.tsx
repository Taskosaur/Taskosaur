// components/charts/organization/sprint-metrics-chart.tsx
import { AreaChart, Area, XAxis, YAxis } from "recharts";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  PLANNING: { label: "Planning", color: "#94A3B8" },
  ACTIVE: { label: "Active", color: "#10B981" },
  COMPLETED: { label: "Completed", color: "#3B82F6" },
  CANCELLED: { label: "Cancelled", color: "#EF4444" },
};

interface SprintMetricsChartProps {
  data: Array<{ status: string; _count: { status: number } }>;
}

export function SprintMetricsChart({ data }: SprintMetricsChartProps) {
  const chartData = data?.map((item) => ({
    status: chartConfig[item.status]?.label || item.status,
    count: item._count.status,
    fill: chartConfig[item.status]?.color || "#8B5CF6",
  }));

  return (
    <ChartWrapper
      title="Sprint Status Overview"
      description="Current sprint distribution across projects"
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <AreaChart data={chartData}>
        <XAxis dataKey="status" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#3B82F6"
          fill="url(#colorCount)"
          fillOpacity={0.6}
        />
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
      </AreaChart>
    </ChartWrapper>
  );
}
