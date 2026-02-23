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
  label: string;
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
  title: string;
  component: React.ComponentType<any>;
  dataKey: keyof AnalyticsData;
  visible: boolean;
  gridCols: string;
  priority: number;
  link?: string;
}

// Helper function to get translation
const t = i18n.t.bind(i18n);

export const organizationAnalyticsWidgets: Widget[] = [
  {
    id: "kpi-metrics",
    title: t("workspace-home:widgets.kpi_metrics"),
    component: OrganizationKPIMetrics,
    dataKey: "kpiMetrics",
    visible: true,
    gridCols: "col-span-full",
    priority: 1,
  },
  {
    id: "project-portfolio",
    title: t("workspace-home:widgets.project_status"),
    component: ProjectPortfolioChart,
    dataKey: "projectPortfolio",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 2,
    link: "/projects",
  },
  {
    id: "team-utilization",
    title: t("workspace-home:widgets.team_utilization"), // Assuming a new key for this
    component: TeamUtilizationChart,
    dataKey: "teamUtilization",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 9,
  },
  {
    id: "task-distribution",
    title: t("workspace-home:widgets.task_priority"),
    component: TaskDistributionChart,
    dataKey: "taskDistribution",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 4,
    link: "/tasks",
  },
  {
    id: "task-type",
    title: t("workspace-home:widgets.task_type"),
    component: TaskTypeChart,
    dataKey: "taskType",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 5,
  },
  {
    id: "sprint-metrics",
    title: t("workspace-home:widgets.sprint_status"),
    component: SprintMetricsChart,
    dataKey: "sprintMetrics",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 6,
  },
  {
    id: "quality-metrics",
    title: t("workspace-home:widgets.quality_metrics"), // Assuming new key
    component: QualityMetricsChart,
    dataKey: "qualityMetrics",
    visible: false,
    gridCols: "col-span-1 md:col-span-1",
    priority: 7,
  },
  {
    id: "workspace-projects",
    title: t("workspace-home:widgets.workspace_projects"), // Assuming new key
    component: WorkspaceProjectChart,
    dataKey: "workspaceProjectCount",
    visible: false,
    gridCols: "col-span-full",
    priority: 8,
  },
  {
    id: "member-workload",
    title: t("workspace-home:widgets.member_workload"), // Assuming new key
    component: MemberWorkloadChart,
    dataKey: "memberWorkload",
    visible: true,
    gridCols: "col-span-1 md:col-span-1",
    priority: 3,
  },
  {
    id: "resource-allocation",
    title: t("workspace-home:widgets.resource_allocation"), // Assuming new key
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
    label: t("workspace-home:analytics.kpi_cards.workspaces"),
    visible: true,
    isDefault: true,
    link: "/workspaces",
  },
  {
    id: "projects",
    label: t("workspace-home:analytics.kpi_cards.projects"),
    visible: true,
    isDefault: true,
    link: "/projects",
  },
  {
    id: "members",
    label: t("workspace-home:analytics.kpi_cards.members"),
    visible: true,
    isDefault: true,
    link: "/organization",
  },
  {
    id: "task-completion",
    label: t("workspace-home:analytics.kpi_cards.task_completion"),
    visible: true,
    isDefault: true,
  },
  {
    id: "bug-resolution",
    label: t("workspace-home:analytics.kpi_cards.bug_resolution"),
    visible: false,
    isDefault: false,
  },
  {
    id: "overdue-tasks",
    label: t("workspace-home:analytics.kpi_cards.overdue_tasks"),
    visible: false,
    isDefault: false,
    link: "/tasks",
  },
  {
    id: "active-sprints",
    label: t("workspace-home:analytics.kpi_cards.active_sprints"),
    visible: false,
    isDefault: false,
  },
  {
    id: "productivity",
    label: t("workspace-home:analytics.kpi_cards.productivity"),
    visible: false,
    isDefault: false,
  },
];
