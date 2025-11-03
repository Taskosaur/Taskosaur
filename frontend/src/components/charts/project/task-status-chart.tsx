// components/charts/project/task-status-chart.tsx
import { PieChart, Pie, ResponsiveContainer, Cell, Legend } from "recharts";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

interface StatusInfo {
  id: string;
  name: string;
  category: string;
  color: string;
  position: number;
}

interface TaskStatusChartData {
  statusId: string;
  count: number;
  status: StatusInfo;
}

interface TaskStatusChartProps {
  data: TaskStatusChartData[];
}

export function TaskStatusChart({ data }: TaskStatusChartProps) {
  // Sort data by status position for better visualization
  const safeData = Array.isArray(data) ? data : [];
  const sortedData = [...safeData].sort(
    (a, b) => (a.status?.position || 0) - (b.status?.position || 0)
  );

  const chartData = sortedData?.map((item) => {
    const status = item.status;
    return {
      name: status?.name || "Unknown",
      value: item.count,
      color: status?.color || "#8B5CF6",
    };
  });

  // Build dynamic config from status data for legend
  const chartConfig = sortedData?.reduce(
    (config, item) => {
      if (item.status) {
        config[item.status.id] = {
          label: item.status.name,
          color: item.status.color,
        };
      }
      return config;
    },
    {} as Record<string, { label: string; color: string }>
  );

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
        fill="var(--accent-foreground, #fff)"
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
      title="Task Status Flow"
      description="Current task distribution by status"
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
            innerRadius={60}
            outerRadius={100}
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
            formatter={(value) => <span className="text-muted-foreground text-xs">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
