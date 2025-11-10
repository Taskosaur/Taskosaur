import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  PLANNING: { label: "Planning", color: "#8B5CF6" },
  ACTIVE: { label: "Active", color: "#10B981" },
  ON_HOLD: { label: "On Hold", color: "#F59E0B" },
  COMPLETED: { label: "Completed", color: "#3B82F6" },
  CANCELLED: { label: "Cancelled", color: "#EF4444" },
};

interface ProjectPortfolioChartProps {
  data: Array<{ status: string; _count: { status: number } }>;
}

export function ProjectPortfolioChart({ data }: ProjectPortfolioChartProps) {
  const chartData = data?.map((item) => ({
    name: chartConfig[item.status]?.label || item.status,
    value: item._count.status,
    fill: chartConfig[item.status]?.color || "#8B5CF6",
  }));

  const totalProjects = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartWrapper
      title="Project Portfolio Status"
      description={`${totalProjects} total projects across organization`}
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />}
            wrapperStyle={{ outline: "none" }}
          />
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={false}
          >
            {chartData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
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
