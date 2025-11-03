export enum ProjectVisibility {
  PRIVATE = "PRIVATE",
  INTERNAL = "INTERNAL",
  PUBLIC = "PUBLIC",
}

export interface ProjectSettings {
  methodology?: string;
  defaultTaskType?: string;
  enableTimeTracking?: boolean;
  allowSubtasks?: boolean;
  workflowId?: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  color?: string;
  status?: string;
  priority?: string;
  visibility?: ProjectVisibility | string;
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  organizationId?: string;
  slug?: string;
  settings?: ProjectSettings;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  _count?: {
    tasks?: number;
    members?: number;
    sprints?: number;
  };
  projectId?: string;
  role?: string;
  userId?: string;
  joinedAt?: string;
  avatar?: string;
}
export interface ProjectData {
  name: string;
  slug: string;
  color: string;
  avatar?: string;
  description: string;
  status: string;
  priority: string;
  visibility?: ProjectVisibility | string;
  startDate: string;
  endDate: string;
  settings: ProjectSettings;
  workspaceId: string;
  workflowId?: string;
}
export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  totalMembers: number;
  completionRate: number;
}
export enum ProjectChartType {
  TASK_STATUS = "task-status",
  TASK_TYPE = "task-type",
  KPI_METRICS = "kpi-metrics",
  TASK_PRIORITY = "task-priority",
  SPRINT_VELOCITY = "sprint-velocity",
}
export interface ProjectChartDataResponse {
  [key: string]: any;
}

export interface ProjectKPIMetrics {
  totalTasks: number;
  completedTasks: number;
  activeSprints: number;
  totalBugs: number;
  resolvedBugs: number;
  completionRate: number;
  bugResolutionRate: number;
}

export interface TaskStatusFlow {
  statusId: string;
  count: number;
  status: {
    id: string;
    name: string;
    color: string;
    category: string;
    position: number;
  };
}

export interface SprintVelocity {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  velocity: number;
}
