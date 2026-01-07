// components/charts/organization/resource-allocation-chart.tsx
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import { ChartWrapper } from "../chart-wrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/contexts/project-context";
import { useOrganization } from "@/contexts/organization-context";
import { ChartType } from "@/types";

const chartConfig = {
  ADMIN: { label: "Admin", color: "#DC2626" },
  MANAGER: { label: "Manager", color: "#EA580C" },
  MEMBER: { label: "Member", color: "#3B82F6" },
  GUEST: { label: "Guest", color: "#10B981" },
  CONTRIBUTOR: { label: "Contributor", color: "#8B5CF6" },
  VIEWER: { label: "Viewer", color: "#94A3B8" },
};

interface ResourceAllocationChartProps {
  data: Array<{
    workspaceId?: string;
    projectId?: string;
    role: string;
    _count: { role: number };
  }>;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const role = payload[0].payload.role;
    const config = chartConfig[role as keyof typeof chartConfig];

    return (
      <div className="border-0 bg-[var(--accent)] p-3 border-gray-200 rounded-lg shadow-md">
        <p className="font-semibold">{config?.label || role}</p>
        <p className="text-sm">{`Count: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

export function ResourceAllocationChart({ data: initialData }: ResourceAllocationChartProps) {
  const { listProjects, projects } = useProject();
  const { fetchSingleChartData, currentOrganization } = useOrganization();
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    listProjects();
  }, []);

  useEffect(() => {
    processData(initialData);
  }, [initialData]);

  const processData = (data: any[]) => {
    // Group data by role and sum counts
    const roleData = (data || []).reduce(
      (acc, item) => {
        const existing = acc.find((a: any) => a.role === item.role);
        if (existing) {
          existing.count += item._count.role;
        } else {
          acc.push({ role: item.role, count: item._count.role });
        }
        return acc;
      },
      [] as Array<{ role: string; count: number }>
    );

    // Sort by count (descending)
    roleData.sort((a, b) => b.count - a.count);

    const mappedData = roleData.map((item) => ({
      role: item.role,
      count: item.count,
      fill: chartConfig[item.role as keyof typeof chartConfig]?.color || "#8B5CF6",
      label: chartConfig[item.role as keyof typeof chartConfig]?.label || item.role,
    }));

    setChartData(mappedData);
  };

  const handleProjectChange = async (projectId: string) => {
    setSelectedProject(projectId);
    if (!currentOrganization) return;

    const filters = projectId === "all" ? {} : { projectId };
    const newData = await fetchSingleChartData(
      currentOrganization.id,
      ChartType.RESOURCE_ALLOCATION,
      filters
    );

    if (newData && !newData.error) {
      processData(newData);
    }
  };

  return (
    <ChartWrapper
      title="Resource Allocation"
      description={
        selectedProject === "all"
          ? "Team member distribution by role"
          : "Role distribution for selected project"
      }
      config={chartConfig}
      className="border-[var(--border)]"
      extraHeader={
        <Select value={selectedProject} onValueChange={handleProjectChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="role"
            tickFormatter={(value) =>
              chartConfig[value as keyof typeof chartConfig]?.label || value
            }
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-sm text-gray-700">
                {chartConfig[value as keyof typeof chartConfig]?.label || value}
              </span>
            )}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} name="role">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
