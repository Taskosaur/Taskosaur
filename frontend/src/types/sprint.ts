export type SprintStatus = "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  velocity?: number;
  status: SprintStatus;
  projectId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    tasks?: number;
    completedTasks?: number;
    inProgressTasks?: number;
    todoTasks?: number;
  };
}

export interface SprintStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  completionRate: number;
  daysRemaining?: number;
  isOverdue: boolean;
}

export interface CreateSprintData {
  name: string;
  goal?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  projectId: string;
}

export interface UpdateSprintData {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: SprintStatus;
}

export interface SprintFilters {
  projectId?: string;
  status?: SprintStatus;
  slug?: string;
}
