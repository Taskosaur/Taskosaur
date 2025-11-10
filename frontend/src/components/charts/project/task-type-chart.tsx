// components/charts/project/task-type-chart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  STORY: { label: "Story", color: "#10B981" },
  TASK: { label: "Task", color: "#3B82F6" },
  BUG: { label: "Bug", color: "#EF4444" },
  EPIC: { label: "Epic", color: "#8B5CF6" },
  FEATURE: { label: "Feature", color: "#F59E0B" },
};

interface TaskTypeChartProps {
  data: Array<{ type: string; _count: { type: number } }>;
}

export function TaskTypeChart({ data }: TaskTypeChartProps) {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = safeData.map((item) => ({
    name: chartConfig[item.type as keyof typeof chartConfig]?.label || item.type,
    value: item._count.type,
    color: chartConfig[item.type as keyof typeof chartConfig]?.color || "#8B5CF6",
  }));

  const typeOrder = ["STORY", "TASK", "BUG", "FEATURE", "EPIC"];
  const sortedChartData =
    chartData &&
    [...chartData].sort((a, b) => {
      return typeOrder.indexOf(a.name.toUpperCase()) - typeOrder.indexOf(b.name.toUpperCase());
    });

  return (
    <ChartWrapper
      title="Task Type Distribution"
      description="Types of tasks in this project"
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
