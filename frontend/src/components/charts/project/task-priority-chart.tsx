// components/charts/project/task-priority-chart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
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

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--accent)] border-0 p-3 rounded-lg shadow-md">
        <p className="font-semibold">{payload[0].name}</p>
        <p className="text-sm">{`Count: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

export function TaskPriorityChart({ data }: TaskPriorityChartProps) {
  const chartData =
    data?.map((item) => ({
      name: chartConfig[item.priority]?.label || item.priority,
      value: item._count.priority,
      fill: chartConfig[item.priority]?.color || "#8B5CF6",
    })) || [];

  // Calculate total for percentage display
  const total = chartData?.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartWrapper
      title="Task Priority Distribution"
      description="Priority breakdown of project tasks"
      config={chartConfig}
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
