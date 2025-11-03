import { Workspace } from "./workspaces";

export enum OrganizationRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  website?: string;
  ownerId: string;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  _count?: {
    members: number;
    workspaces: number;
  };
  userRole?: OrganizationRole;
  joinedAt?: string;
  isOwner?: boolean;
  memberCount?: number;
  workspaceCount?: number;
  workspaces?: Workspace[];
  isDefault?: boolean;
}

export interface OrganizationResponse {
  organizations?: Organization[];
  data?: Organization[];
  organization?: Organization | Organization[];
}

export interface OrganizationStats {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  statistics: {
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    activeProjects: number;
    totalActiveWorkspaces: number;
  };
  recentActivities: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  type:
    | "TASK_CREATED"
    | "TASK_COMPLETED"
    | "TASK_UPDATED"
    | "PROJECT_CREATED"
    | "MEMBER_ADDED"
    | "WORKSPACE_CREATED";
  description: string;
  entityType: "Task" | "Project" | "Workspace" | "Member";
  entityId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}
export interface CreateOrganizationData {
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  settings?: OrganizationSettings;
  defaultWorkspace?: { name: string };
  defaultProject?: { name: string };
}

export interface ActivityFilters {
  limit?: number;
  page?: number;
  entityType?: "Task" | "Project" | "Workspace" | "Organization" | "User";
  userId?: string;
}

export interface ActivityItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityResponse {
  activities: ActivityItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface OrganizationMember {
  id: string;
  role: OrganizationRole;
  joinedAt: Date;
  userId: string;
  organizationId: string;
  status?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    avatar?: string;
  };
  organization?: {
    id: string;
    name: string;
    slug?: string;
  };
  creator?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  updater?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
}

export interface CreateOrganizationDto {
  name: string;
  slug: string;
  description?: string;
  avatar?: string;
  website?: string;
  settings?: OrganizationSettings;
}

export interface UpdateOrganizationDto extends Partial<CreateOrganizationDto> {}

export interface OrganizationStats {
  totalMembers: number;
  totalWorkspaces: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  activeMembers: number;
  tasksThisWeek: number;
  projectsThisMonth: number;
}

export interface OrganizationSettings {
  general?: {
    name: string;
    slug?: string;
    description?: string;
    avatar?: string;
    website?: string;
  };
  preferences?: {
    timezone: string;
    language: string;
    dateFormat: string;
    timeFormat: string;
  };
  features?: {
    timeTracking: boolean;
    customFields: boolean;
    automation: boolean;
    integrations: boolean;
  };
  allowInvites?: boolean;
  requireEmailVerification?: boolean;
  defaultRole?: OrganizationRole;
  notifications?: {
    emailNotifications: boolean;
    slackNotifications: boolean;
    webhookUrl?: string;
  };
  security?: {
    requireTwoFactor: boolean;
    allowGuestAccess: boolean;
    sessionTimeout: number;
  };
  requireTwoFactor?: boolean;
  allowGuestAccess?: boolean;
  sessionTimeout?: number;
  emailNotifications?: boolean;
  slackNotifications?: boolean;
  webhookUrl?: string;
  timeTracking?: boolean;
  customFields?: boolean;
  timeFormat?: string;
}

export interface InviteMemberDto {
  email: string;
  role: OrganizationRole;
  message?: string;
}

export interface OrganizationActivity {
  id: string;
  type:
    | "MEMBER_JOINED"
    | "MEMBER_LEFT"
    | "WORKSPACE_CREATED"
    | "PROJECT_CREATED"
    | "SETTINGS_UPDATED";
  description: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}
export enum ChartType {
  KPI_METRICS = "kpi-metrics",
  PROJECT_PORTFOLIO = "project-portfolio",
  TEAM_UTILIZATION = "team-utilization",
  TASK_DISTRIBUTION = "task-distribution",
  TASK_TYPE = "task-type",
  SPRINT_METRICS = "sprint-metrics",
  QUALITY_METRICS = "quality-metrics",
  WORKSPACE_PROJECT_COUNT = "workspace-project-count",
  MEMBER_WORKLOAD = "member-workload",
  RESOURCE_ALLOCATION = "resource-allocation",
}

// Type definitions for better type safety
export interface ChartDataResponse {
  [key: string]: any;
}

export interface KPIMetrics {
  totalWorkspaces: number;
  activeWorkspaces: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalMembers: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalBugs: number;
  resolvedBugs: number;
  activeSprints: number;
  projectCompletionRate: number;
  taskCompletionRate: number;
  bugResolutionRate: number;
  overallProductivity: number;
}

export interface QualityMetrics {
  totalBugs: number;
  resolvedBugs: number;
  criticalBugs: number;
  resolvedCriticalBugs: number;
  bugResolutionRate: number;
  criticalBugResolutionRate: number;
}

export interface WorkspaceProjectCount {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  projectCount: number;
}

export interface MemberWorkload {
  memberId: string;
  memberName: string;
  activeTasks: number;
  reportedTasks: number;
}
