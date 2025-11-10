// components/charts/organization/team-utilization-chart.tsx
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  ADMIN: { label: "Admin", color: "#DC2626" },
  MANAGER: { label: "Manager", color: "#EA580C" },
  MEMBER: { label: "Member", color: "#3B82F6" },
  VIEWER: { label: "Viewer", color: "#10B981" },
};

interface TeamUtilizationChartProps {
  data: Array<{ role: string; _count: { role: number } }>;
}

export function TeamUtilizationChart({ data }: TeamUtilizationChartProps) {
  const chartData = data?.map((item) => ({
    role: chartConfig[item.role]?.label || item.role,
    count: item._count.role,
    fullMark: Math.max(...data.map((d) => d._count.role)) + 2, // Add some padding for better visualization
    fill: chartConfig[item.role]?.color || "#8B5CF6",
  }));

  return (
    <ChartWrapper
      title="Team Role Distribution"
      description="Organization member roles breakdown"
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="role" />
          <PolarRadiusAxis />
          <ChartTooltip content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />} />
          <Radar name="Count" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
