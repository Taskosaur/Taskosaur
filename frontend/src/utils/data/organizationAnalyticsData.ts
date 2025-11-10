import { OrganizationKPIMetrics } from "@/components/charts/dashboard/organization-kpi-metrics";
import { ProjectPortfolioChart } from "@/components/charts/dashboard/project-portfolio-chart";
import { TeamUtilizationChart } from "@/components/charts/dashboard/team-utilization-chart";
import { TaskDistributionChart } from "@/components/charts/dashboard/task-distribution-chart";
import { SprintMetricsChart } from "@/components/charts/dashboard/sprint-metrics-chart";
import { QualityMetricsChart } from "@/components/charts/dashboard/quality-metrics-chart";
import { WorkspaceProjectChart } from "@/components/charts/dashboard/workspace-project-chart";
import { MemberWorkloadChart } from "@/components/charts/dashboard/member-workload-chart";
import { ResourceAllocationChart } from "@/components/charts/dashboard/resource-allocation-chart";
import { TaskTypeChart } from "@/components/charts/dashboard/task-type-chart";

export interface KPICard {
  id: string;
  label: string;
  visible: boolean;
  isDefault: boolean;
}

export interface AnalyticsData {
  kpiMetrics: any;
  projectPortfolio: any[];
  teamUtilization: any[];
  taskDistribution: any[];
  taskType: any[];
  sprintMetrics: any[];
  qualityMetrics: any;
  workspaceProjectCount: any[];
  memberWorkload: any[];
  resourceAllocation: any[];
}

export interface Widget {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  dataKey: keyof AnalyticsData;
  visible: boolean;
  gridCols: string;
  priority: number;
}

export const organizationAnalyticsWidgets: Widget[] = [
  {
    id: "kpi-metrics",
    title: "Organization KPIs",
    component: OrganizationKPIMetrics,
    dataKey: "kpiMetrics",
    visible: true,
    gridCols: "col-span-full",
    priority: 1,
  },
  {
    id: "project-portfolio",
    title: "Project Portfolio Status",
    component: ProjectPortfolioChart,
    dataKey: "projectPortfolio",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 2,
  },
  {
    id: "team-utilization",
    title: "Team Role Distribution",
    component: TeamUtilizationChart,
    dataKey: "teamUtilization",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 9,
  },
  {
    id: "task-distribution",
    title: "Task Priority Distribution",
    component: TaskDistributionChart,
    dataKey: "taskDistribution",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 4,
  },
  {
    id: "task-type",
    title: "Task Type Distribution",
    component: TaskTypeChart,
    dataKey: "taskType",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 5,
  },
  {
    id: "sprint-metrics",
    title: "Sprint Status Overview",
    component: SprintMetricsChart,
    dataKey: "sprintMetrics",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 6,
  },
  {
    id: "quality-metrics",
    title: "Bug Resolution Quality",
    component: QualityMetricsChart,
    dataKey: "qualityMetrics",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 7,
  },
  {
    id: "workspace-projects",
    title: "Projects per Workspace",
    component: WorkspaceProjectChart,
    dataKey: "workspaceProjectCount",
    visible: false,
    gridCols: "col-span-full",
    priority: 8,
  },
  {
    id: "member-workload",
    title: "Member Workload Distribution",
    component: MemberWorkloadChart,
    dataKey: "memberWorkload",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 3,
  },
  {
    id: "resource-allocation",
    title: "Resource Allocation",
    component: ResourceAllocationChart,
    dataKey: "resourceAllocation",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 10,
  },
];

export const organizationKPICards: KPICard[] = [
  {
    id: "workspaces",
    label: "Total Workspaces",
    visible: true,
    isDefault: true,
  },
  {
    id: "projects",
    label: "Total Projects",
    visible: true,
    isDefault: true,
  },
  {
    id: "members",
    label: "Team Members",
    visible: true,
    isDefault: true,
  },
  {
    id: "task-completion",
    label: "Task Completion",
    visible: true,
    isDefault: true,
  },
  {
    id: "bug-resolution",
    label: "Bug Resolution",
    visible: false,
    isDefault: false,
  },
  {
    id: "overdue-tasks",
    label: "Overdue Tasks",
    visible: false,
    isDefault: false,
  },
  {
    id: "active-sprints",
    label: "Active Sprints",
    visible: false,
    isDefault: false,
  },
  {
    id: "productivity",
    label: "Overall Productivity",
    visible: false,
    isDefault: false,
  },
];
