// components/charts/workspace/task-type-chart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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
  const chartData = data?.map((item) => ({
    name: chartConfig[item.type as keyof typeof chartConfig]?.label || item.type,
    value: item._count.type,
    color: chartConfig[item.type as keyof typeof chartConfig]?.color || "#8B5CF6",
  }));

  // Custom label renderer
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ChartWrapper
      title="Task Type Distribution"
      description="Types of tasks across workspace"
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
            paddingAngle={2}
            dataKey="value"
          >
            {chartData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent className="bg-[var(--accent)] border-0" />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={10}
            formatter={(value, entry: any) => (
              <span key={entry} className="text-muted-foreground text-xs">
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
