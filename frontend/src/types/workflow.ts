import { TaskStatus } from "./task-status";
import type { User } from "./users";
import { ActivityLog } from "./workspaces";

export type WorkflowStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface WorkflowData {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface CreateWorkflowData extends WorkflowData {
  organizationId: string;
}

export interface UpdateWorkflowData extends Partial<WorkflowData> {}

export interface WorkflowStats {
  totalStages: number;
  totalProjects: number;
  totalTasks: number;
  activeProjects: number;
  completedTasks: number;
  utilizationRate: number;
}

export interface WorkflowStage {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order: number;
  workflowId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowActivityResponse {
  activities: ActivityLog[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface GetWorkflowActivityParams {
  limit?: number;
  page?: number;
  entityType?: string;
}

export interface Workflow extends WorkflowData {
  id: string;
  organizationId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: any;
  statuses?: TaskStatus[];
  transitions?: any[];
  createdBy?: User;
  updatedBy?: User;
  _count?: {
    statuses: number;
    transitions: number;
  };
}
