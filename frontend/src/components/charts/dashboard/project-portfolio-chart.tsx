import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { useTranslation } from "react-i18next";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  PLANNING: { label: "project_status.planning", color: "#8B5CF6" },
  ACTIVE: { label: "project_status.active", color: "#10B981" },
  ON_HOLD: { label: "project_status.on_hold", color: "#F59E0B" },
  COMPLETED: { label: "project_status.completed", color: "#3B82F6" },
  CANCELLED: { label: "project_status.cancelled", color: "#EF4444" },
};

interface ProjectPortfolioChartProps {
  data: Array<{ status: string; _count: { status: number } }>;
}

export function ProjectPortfolioChart({ data }: ProjectPortfolioChartProps) {
  const { t } = useTranslation("workspace-home");
  const chartData = data?.map((item) => ({
    name: t(chartConfig[item.status]?.label) || item.status,
    value: item._count.status,
    fill: chartConfig[item.status]?.color || "#8B5CF6",
  }));

  const totalProjects = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartWrapper
      title={t("widgets.project_status")}
      description={t("charts.project_status_description_with_count", { count: totalProjects })}
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
            cy="45%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={true}
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
