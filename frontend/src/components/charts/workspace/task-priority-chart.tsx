// components/charts/workspace/task-priority-chart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  LOWEST: { label: "Lowest", color: "#94A3B8" },
  LOW: { label: "Low", color: "#3B82F6" },
  MEDIUM: { label: "Medium", color: "#F59E0B" },
  HIGH: { label: "High", color: "#EF4444" },
  HIGHEST: { label: "Highest", color: "#DC2626" },
};

interface TaskPriorityChartProps {
  data: Array<{ priority: string; _count: { priority: number } }>;
}

export function TaskPriorityChart({ data }: TaskPriorityChartProps) {
  const chartData = data?.map((item) => ({
    name: chartConfig[item.priority as keyof typeof chartConfig]?.label || item.priority,
    value: item._count.priority,
    color: chartConfig[item.priority as keyof typeof chartConfig]?.color || "#8B5CF6",
  }));

  // Sort data by priority level for better visualization
  const priorityOrder = ["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"];
  const sortedChartData =
    chartData &&
    [...chartData].sort((a, b) => {
      return (
        priorityOrder.indexOf(a.name.toUpperCase()) - priorityOrder.indexOf(b.name.toUpperCase())
      );
    });

  return (
    <ChartWrapper
      title="Task Priority Distribution"
      description="Priority breakdown across all tasks"
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
