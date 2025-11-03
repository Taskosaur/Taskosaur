import { Task, TaskCategory, TaskPriority } from "./tasks";

export interface TaskStatus {
  id: string;
  name: string;
  color?: string;
  category?: TaskCategory;
  position?: number;
  isDefault?: boolean;
  description?: string;
  order?: number;
  workflowId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: TaskPriority;
  statusId?: string;
  assigneeId?: string;
  projectId?: string;
  sprintId?: string;
  workspaceId?: string;
  parentTaskId?: string;
  dueDate?: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  statusId?: string;
  assigneeId?: string;
  projectId?: string;
  sprintId?: string;
  workspaceId?: string;
  parentTaskId?: string;
  dueDate?: string;
}

export interface CreateTaskStatusDto {
  name: string;
  color: string;
  category: "TODO" | "IN_PROGRESS" | "DONE";
  position?: number;
  workflowId: string;
}

export interface UpdateTaskStatusDto {
  name?: string;
  color?: string;
  category?: "TODO" | "IN_PROGRESS" | "DONE";
  position?: number;
  isDefault?: boolean;
  workflowId?: string;
}

export interface TaskFilters {
  projectId?: string;
  sprintId?: string;
  workspaceId?: string;
  parentTaskId?: string;
  priority?: TaskPriority;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TaskPaginatedResponse {
  tasks: Task[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
}

export interface TodaysTasksParams {
  organizationId: string;
  page?: number;
  limit?: number;
}

export interface OrganizationTasksParams {
  organizationId: string;
  priority?: TaskPriority;
  search?: string;
  page?: number;
  limit?: number;
}
export interface CreateTaskStatusFromProjectDto {
  name: string;
  projectId: string;
}
