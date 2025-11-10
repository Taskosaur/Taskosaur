// components/charts/workspace/sprint-status-chart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  PLANNING: { label: "Planning", color: "#94A3B8" },
  ACTIVE: { label: "Active", color: "#10B981" },
  COMPLETED: { label: "Completed", color: "#3B82F6" },
  CANCELLED: { label: "Cancelled", color: "#EF4444" },
};

interface SprintStatusChartProps {
  data: Array<{ status: string; _count: { status: number } }>;
}

export function SprintStatusChart({ data }: SprintStatusChartProps) {
  const chartData = data?.map((item) => ({
    name: chartConfig[item.status as keyof typeof chartConfig]?.label || item.status,
    value: item._count.status,
    color: chartConfig[item.status as keyof typeof chartConfig]?.color || "#8B5CF6",
  }));

  // Sort data by status for better visualization
  const statusOrder = ["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"];
  const sortedChartData =
    chartData &&
    [...chartData].sort((a, b) => {
      return statusOrder.indexOf(a.name.toUpperCase()) - statusOrder.indexOf(b.name.toUpperCase());
    });

  return (
    <ChartWrapper
      title="Sprint Status Overview"
      description="Current sprint status across projects"
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={sortedChartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          barSize={40}
        >
          <XAxis dataKey="name" tickLine={true} axisLine={true} tick={{ fontSize: 12 }} />
          <YAxis tickLine={true} axisLine={true} tick={{ fontSize: 12 }} allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent hideLabel={true} className="bg-[var(--accent)] border-0" />
            }
            cursor={{ fill: "rgba(0, 0, 0, 0.00)" }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {sortedChartData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
