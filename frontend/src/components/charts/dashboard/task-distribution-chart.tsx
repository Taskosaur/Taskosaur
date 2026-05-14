// components/charts/organization/task-distribution-chart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { useTranslation } from "react-i18next";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  LOWEST: { label: "priority.lowest", color: "#94A3B8" },
  LOW: { label: "priority.low", color: "#10B981" },
  MEDIUM: { label: "priority.medium", color: "#F59E0B" },
  HIGH: { label: "priority.high", color: "#EF4444" },
  HIGHEST: { label: "priority.highest", color: "#DC2626" },
};

interface TaskDistributionChartProps {
  data: Array<{ priority: string; _count: { priority: number } }>;
}

export function TaskDistributionChart({ data }: TaskDistributionChartProps) {
  const { t } = useTranslation("workspace-home");
  const chartData = data
    .map((item) => ({
      priority: t(chartConfig[item.priority]?.label) || item.priority,
      count: item._count.priority,
      fill: chartConfig[item.priority]?.color || "#8B5CF6",
      key: item.priority,
    }))
    .sort((a, b) => {
      const order = ["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"];
      return order.indexOf(a.key) - order.indexOf(b.key);
    });

  return (
    <ChartWrapper
      title={t("widgets.task_priority")}
      description={t("charts.task_priority_description")}
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          barSize={60}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="priority"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            fontSize={12}
            fontWeight={500}
          />
          <YAxis axisLine={false} tickLine={false} tickMargin={10} fontSize={12} width={40} />
          <ChartTooltip
            content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />}
            cursor={{ fill: "rgba(0, 0, 0, 0.00)" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
