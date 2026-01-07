// components/charts/organization/team-utilization-chart.tsx
import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/contexts/workspace-context";
import { useOrganization } from "@/contexts/organization-context";
import { ChartType } from "@/types";

const chartConfig = {
  ADMIN: { label: "Admin", color: "#DC2626" },
  MANAGER: { label: "Manager", color: "#EA580C" },
  MEMBER: { label: "Member", color: "#3B82F6" },
  VIEWER: { label: "Viewer", color: "#10B981" },
};

interface TeamUtilizationChartProps {
  data: Array<{ role: string; _count: { role: number } }>;
}

export function TeamUtilizationChart({ data: initialData }: TeamUtilizationChartProps) {
  const { workspaces, getWorkspacesByOrganization } = useWorkspace();
  const { fetchSingleChartData, currentOrganization } = useOrganization();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (currentOrganization?.id) {
      getWorkspacesByOrganization(currentOrganization.id);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    const mappedData = initialData?.map((item) => ({
      role: chartConfig[item.role as keyof typeof chartConfig]?.label || item.role,
      count: item._count.role,
      fill: chartConfig[item.role as keyof typeof chartConfig]?.color || "#8B5CF6",
    }));
    setChartData(mappedData || []);
  }, [initialData]);

  const handleWorkspaceChange = async (workspaceId: string) => {
    setSelectedWorkspace(workspaceId);
    if (!currentOrganization) return;

    const filters = workspaceId === "all" ? {} : { workspaceId };
    const newData = await fetchSingleChartData(
      currentOrganization.id,
      ChartType.TEAM_UTILIZATION,
      filters
    );

    if (newData && !newData.error) {
      const mappedData = newData.map((item: any) => ({
        role: chartConfig[item.role as keyof typeof chartConfig]?.label || item.role,
        count: item._count.role,
        fill: chartConfig[item.role as keyof typeof chartConfig]?.color || "#8B5CF6",
      }));
      setChartData(mappedData);
    }
  };

  return (
    <ChartWrapper
      title="Team Role Distribution"
      description={
        selectedWorkspace === "all"
          ? "Organization member roles breakdown"
          : `Role breakdown for selected workspace`
      }
      config={chartConfig}
      className="border-[var(--border)]"
      extraHeader={
        <Select value={selectedWorkspace} onValueChange={handleWorkspaceChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="All Workspaces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workspaces</SelectItem>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="role" />
          <PolarRadiusAxis />
          <ChartTooltip content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />} />
          <Radar
            name="Count"
            dataKey="count"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
