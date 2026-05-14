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
import i18n from '@/lib/i18n'; // Import the i18n instance

export interface KPICard {
  id: string;
  label: string; // This will store a translation key
  visible: boolean;
  isDefault: boolean;
  link?: string;
}

export interface AnalyticsData {
  kpiMetrics: any;
  projectPortfolio: any[];
  teamUtilization: any[];
  taskDistribution: any[];
  taskType: any[];
  sprintMetrics: any[];
  qualityMetrics: any[];
  workspaceProjectCount: any[];
  memberWorkload: any[];
  resourceAllocation: any[];
}

export interface Widget {
  id: string;
  title: string; // This will store a translation key
  component: React.ComponentType<any>;
  dataKey: keyof AnalyticsData;
  visible: boolean;
  gridCols: string;
  priority: number;
  link?: string;
}

export const organizationAnalyticsWidgets: Widget[] = [
  {
    id: "kpi-metrics",
    title: "workspace-home:widgets.kpi_metrics",
    component: OrganizationKPIMetrics,
    dataKey: "kpiMetrics",
    visible: true,
    gridCols: "col-span-full",
    priority: 1,
  },
  {
    id: "project-portfolio",
    title: "workspace-home:widgets.project_status",
    component: ProjectPortfolioChart,
    dataKey: "projectPortfolio",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 2,
    link: "/projects",
  },
  {
    id: "team-utilization",
    title: "workspace-home:widgets.team_utilization",
    component: TeamUtilizationChart,
    dataKey: "teamUtilization",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 9,
  },
  {
    id: "task-distribution",
    title: "workspace-home:widgets.task_priority",
    component: TaskDistributionChart,
    dataKey: "taskDistribution",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 4,
    link: "/tasks",
  },
  {
    id: "task-type",
    title: "workspace-home:widgets.task_type",
    component: TaskTypeChart,
    dataKey: "taskType",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 5,
  },
  {
    id: "sprint-metrics",
    title: "workspace-home:widgets.sprint_status",
    component: SprintMetricsChart,
    dataKey: "sprintMetrics",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 6,
  },
  {
    id: "quality-metrics",
    title: "workspace-home:widgets.quality_metrics",
    component: QualityMetricsChart,
    dataKey: "qualityMetrics",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 7,
  },
  {
    id: "workspace-projects",
    title: "workspace-home:widgets.workspace_projects",
    component: WorkspaceProjectChart,
    dataKey: "workspaceProjectCount",
    visible: false,
    gridCols: "col-span-full",
    priority: 8,
  },
  {
    id: "member-workload",
    title: "workspace-home:widgets.member_workload",
    component: MemberWorkloadChart,
    dataKey: "memberWorkload",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 3,
  },
  {
    id: "resource-allocation",
    title: "workspace-home:widgets.resource_allocation",
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
    label: "workspace-home:analytics.kpi_cards.workspaces",
    visible: true,
    isDefault: true,
    link: "/workspaces",
  },
  {
    id: "projects",
    label: "workspace-home:analytics.kpi_cards.projects",
    visible: true,
    isDefault: true,
    link: "/projects",
  },
  {
    id: "members",
    label: "workspace-home:analytics.kpi_cards.members",
    visible: true,
    isDefault: true,
    link: "/organization",
  },
  {
    id: "task-completion",
    label: "workspace-home:analytics.kpi_cards.task_completion",
    visible: true,
    isDefault: true,
  },
  {
    id: "bug-resolution",
    label: "workspace-home:analytics.kpi_cards.bug_resolution",
    visible: false,
    isDefault: false,
  },
  {
    id: "overdue-tasks",
    label: "workspace-home:analytics.kpi_cards.overdue_tasks",
    visible: false,
    isDefault: false,
    link: "/tasks",
  },
  {
    id: "active-sprints",
    label: "workspace-home:analytics.kpi_cards.active_sprints",
    visible: false,
    isDefault: false,
  },
  {
    id: "productivity",
    label: "workspace-home:analytics.kpi_cards.productivity",
    visible: false,
    isDefault: false,
  },
];
