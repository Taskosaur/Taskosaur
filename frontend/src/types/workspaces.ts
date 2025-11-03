export type WorkspaceRole = "SUPER_ADMIN" | "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";

export interface WorkspaceData {
  name: string;
  description?: string;
  color?: string;
  slug?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  organizationId: string;
  memberCount?: number;
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
  lastActivity?: string;
  createdBy?: string;
  _count?: {
    members: number;
    projects: number;
    tasks?: number;
  };
  members?: {
    role: WorkspaceRole;
  }[];
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AddMemberToWorkspaceData {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface InviteMemberToWorkspaceData {
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface UpdateMemberRoleData {
  role: WorkspaceRole;
}

export interface WorkspaceStats {
  totalMembers: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  activeProjects: number;
  completionRate: number;
}

export interface CreateWorkspaceData extends WorkspaceData {
  organizationId: string;
  slug?: string;
}
export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  type: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface WorkspaceActivityResponse {
  activities: ActivityLog[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface GetWorkspaceActivityParams {
  limit?: number;
  page?: number;
  entityType?: string;
}

export interface AddMemberToWorkspaceData {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface InviteMemberToWorkspaceData {
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface UpdateMemberRoleData {
  role: WorkspaceRole;
}
export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  type: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface WorkspaceActivityResponse {
  activities: ActivityLog[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface GetWorkspaceActivityParams {
  limit?: number;
  page?: number;
  entityType?: string;
}

export enum WorkspaceChartType {
  PROJECT_STATUS = "project-status",
  TASK_PRIORITY = "task-priority",
  KPI_METRICS = "kpi-metrics",
  TASK_TYPE = "task-type",
  SPRINT_STATUS = "sprint-status",
  MONTHLY_COMPLETION = "monthly-completion",
}
export interface WorkspaceChartDataResponse {
  [key: string]: any;
}

export interface WorkspaceKPIMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  overdueTasks: number;
  completionRate: number;
}

export interface MonthlyTaskCompletion {
  month: string;
  count: number;
}
