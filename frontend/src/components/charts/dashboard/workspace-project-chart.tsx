// components/charts/organization/workspace-project-chart.tsx
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  high: { label: ">10 Projects", color: "#10B981" },
  medium: { label: "6-10 Projects", color: "#F59E0B" },
  low: { label: "<=5 Projects", color: "#3B82F6" },
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
      title="Projects per Workspace"
      description="Project distribution across workspaces"
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <BarChart data={chartData}>
        <XAxis dataKey="workspace" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />} />
        <Bar dataKey="projects" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartWrapper>
  );
}
