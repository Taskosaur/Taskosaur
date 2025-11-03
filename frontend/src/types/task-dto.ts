import { Task } from "./tasks";

export interface CreateTaskRequest {
  title: string;
  description?: string;
  type?: "TASK" | "STORY" | "BUG" | "EPIC";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  startDate?: string;
  dueDate?: string;
  storyPoints?: number;
  originalEstimate?: number;
  remainingEstimate?: number;
  customFields?: Record<string, any>;
  projectId: string;
  assigneeIds?: string[];
  reporterIds?: string[];
  statusId: string;
  sprintId?: string;
  parentTaskId?: string;
  completedAt?: string | null;
  attachments?: File[];
}

export interface CreateSubtaskRequest extends CreateTaskRequest {
  parentTaskId: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  type?: "TASK" | "STORY" | "BUG" | "EPIC" | "SUBTASK";
  startDate?: string;
  dueDate?: string;
  remainingEstimate?: number;
  assigneeIds?: string[];
  reporterIds?: string[];
  statusId?: string;
  projectId?: string;
  allowEmailReplies?: boolean;
}
export interface TasksResponse {
  tasks: Task[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface GetTasksParams {
  page?: number;
  limit?: number;
  assigneeId?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  search?: string;
}
