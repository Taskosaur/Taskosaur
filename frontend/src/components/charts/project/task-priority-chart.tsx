// components/charts/project/task-priority-chart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ChartWrapper } from "../chart-wrapper";
import { useTranslation } from "react-i18next";

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

// Custom label component to show both priority and count
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  value,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="var(--accent-foreground, #fff)"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${name}: ${value}`}
    </text>
  );
};

export function TaskPriorityChart({ data }: TaskPriorityChartProps) {
  const { t } = useTranslation(["analytics"]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--accent)] border-0 p-3 rounded-lg shadow-md">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm">{`${t("charts.task_priority_distribution.count")}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const translatedConfig = {
    LOWEST: { label: t("charts.task_priority_distribution.priorities.lowest"), color: chartConfig.LOWEST.color },
    LOW: { label: t("charts.task_priority_distribution.priorities.low"), color: chartConfig.LOW.color },
    MEDIUM: { label: t("charts.task_priority_distribution.priorities.medium"), color: chartConfig.MEDIUM.color },
    HIGH: { label: t("charts.task_priority_distribution.priorities.high"), color: chartConfig.HIGH.color },
    HIGHEST: { label: t("charts.task_priority_distribution.priorities.highest"), color: chartConfig.HIGHEST.color },
  };

  const chartData =
    data?.map((item) => ({
      name: translatedConfig[item.priority as keyof typeof translatedConfig]?.label || item.priority,
      value: item._count.priority,
      fill: translatedConfig[item.priority as keyof typeof translatedConfig]?.color || "#8B5CF6",
    })) || [];

  // Calculate total for percentage display
  const total = chartData?.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartWrapper
      title={t("charts.task_priority_distribution.title")}
      description={t("charts.task_priority_distribution.description")}
      config={translatedConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            paddingAngle={2}
          >
            {chartData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any, index) => (
              <span key={entry} className="text-sm text-gray-700">
                {value}: {chartData[index]?.value} (
                {((chartData[index]?.value / total) * 100).toFixed(1)}%)
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
