// components/charts/organization/workspace-project-chart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  high: { label: "project_count.high", color: "#10B981" },
  medium: { label: "project_count.medium", color: "#F59E0B" },
  low: { label: "project_count.low", color: "#3B82F6" },
};

interface WorkspaceProjectChartProps {
  data: Array<{
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    projectCount: number;
  }>;
}

export function WorkspaceProjectChart({ data }: WorkspaceProjectChartProps) {
  const { t } = useTranslation("workspace-home");
  const chartData = data?.map((item) => ({
    workspace:
      item.workspaceName.length > 15
        ? `${item.workspaceName.substring(0, 15)}...`
        : item.workspaceName,
    projects: item.projectCount,
    fill:
      item.projectCount > 10
        ? chartConfig.high.color
        : item.projectCount > 5
          ? chartConfig.medium.color
          : chartConfig.low.color,
  }));

  return (
    <ChartWrapper
      title={t("widgets.workspace_projects")}
      description={t("charts.workspace_projects_description")}
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="workspace" angle={-45} textAnchor="end" height={100} />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />} />
          <Bar dataKey="projects" radius={[4, 4, 0, 0]} fill="fill" />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}