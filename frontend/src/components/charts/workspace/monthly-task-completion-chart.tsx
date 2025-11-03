// components/charts/workspace/monthly-task-completion-chart.tsx
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  completion: { label: "Tasks Completed", color: "#3B82F6" },
};

interface MonthlyTaskCompletionChartProps {
  data: Array<{ month: string; count: number }>;
}

export function MonthlyTaskCompletionChart({ data }: MonthlyTaskCompletionChartProps) {
  const chartData = data
    ?.map((item) => ({
      month: new Date(item.month + "-01").toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      completion: item.count,
    }))
    .reverse(); // Show chronological order

  return (
    <ChartWrapper
      title="Monthly Task Completion Trend"
      description="Tasks completed per month across workspace"
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tickLine={true} axisLine={true} tick={{ fontSize: 12 }} />
          <YAxis tickLine={true} axisLine={true} tick={{ fontSize: 12 }} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent className="bg-[var(--accent)] border-0" />} />
          <Line
            type="monotone"
            dataKey="completion"
            stroke={chartConfig.completion.color}
            strokeWidth={3}
            dot={{
              fill: chartConfig.completion.color,
              strokeWidth: 2,
              r: 4,
              stroke: "#fff",
            }}
            activeDot={{
              r: 6,
              fill: chartConfig.completion.color,
              stroke: "#fff",
              strokeWidth: 2,
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
