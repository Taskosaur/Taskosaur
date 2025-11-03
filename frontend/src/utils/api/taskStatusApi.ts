import api from "@/lib/api";
import {
  CreateTaskStatusDto,
  CreateTaskStatusFromProjectDto,
  TaskStatus,
  UpdateTaskStatusDto,
} from "@/types";

// Task Status API - aligned with your NestJS controller
export const taskStatusApi = {
  // Create task status
  createTaskStatus: async (taskStatusData: CreateTaskStatusDto): Promise<TaskStatus> => {
    try {
      const response = await api.post<TaskStatus>("/task-statuses", taskStatusData);
      return response.data;
    } catch (error) {
      console.error("Create task status error:", error);
      throw error;
    }
  },
  createTaskStatusFromProject: async (
    taskStatusData: CreateTaskStatusFromProjectDto
  ): Promise<TaskStatus> => {
    try {
      const response = await api.post<TaskStatus>(
        "/task-statuses/from-project", // updated endpoint
        taskStatusData
      );
      return response.data;
    } catch (error) {
      console.error("Create task status from project error:", error);
      throw error;
    }
  },

  // Get all task statuses with optional workflow filter
  getTaskStatuses: async (workflowId?: string): Promise<TaskStatus[]> => {
    try {
      const params = workflowId ? `?workflowId=${workflowId}` : "";
      const response = await api.get<TaskStatus[]>(`/task-statuses${params}`);
      return response.data;
    } catch (error) {
      console.error("Get task statuses error:", error);
      throw error;
    }
  },
  getTaskStatusByProject: async (projectId: string): Promise<TaskStatus[]> => {
    try {
      const params = `?projectId=${projectId}`;
      const response = await api.get<TaskStatus[]>(`/task-statuses/project${params}`);
      return response.data;
    } catch (error) {
      console.error("Get task statuses error:", error);
      throw error;
    }
  },
  // Get task status by ID
  getTaskStatusById: async (statusId: string): Promise<TaskStatus> => {
    try {
      const response = await api.get<TaskStatus>(`/task-statuses/${statusId}`);
      return response.data;
    } catch (error) {
      console.error("Get task status by ID error:", error);
      throw error;
    }
  },

  // Update task status
  updateTaskStatus: async (
    statusId: string,
    taskStatusData: UpdateTaskStatusDto
  ): Promise<TaskStatus> => {
    try {
      const response = await api.patch<TaskStatus>(`/task-statuses/${statusId}`, taskStatusData);
      return response.data;
    } catch (error) {
      console.error("Update task status error:", error);
      throw error;
    }
  },
  updateTaskStatusPositions: async (
    statusUpdates: { id: string; position: number }[]
  ): Promise<TaskStatus[]> => {
    try {
      const response = await api.patch<TaskStatus[]>("/task-statuses/positions", { statusUpdates });
      return response.data;
    } catch (error) {
      console.error("Update task status positions error:", error);
      throw error;
    }
  },

  // Delete task status
  deleteTaskStatus: async (statusId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete(`/task-statuses/${statusId}`);

      const status = response.status;
      if (status === 204 || status === 200) {
        return { success: true, message: "Task status deleted successfully" };
      }

      return (
        response.data || {
          success: true,
          message: "Task status deleted successfully",
        }
      );
    } catch (error) {
      console.error("Delete task status error:", error);
      throw error;
    }
  },

  // Utility functions for task statuses
  getStatusColor: (category: "TODO" | "IN_PROGRESS" | "DONE"): string => {
    switch (category) {
      case "TODO":
        return "#6b7280"; // gray
      case "IN_PROGRESS":
        return "#3b82f6"; // blue
      case "DONE":
        return "#22c55e"; // green
      default:
        return "#6b7280"; // gray
    }
  },

  getCategoryLabel: (category: "TODO" | "IN_PROGRESS" | "DONE"): string => {
    switch (category) {
      case "TODO":
        return "To Do";
      case "IN_PROGRESS":
        return "In Progress";
      case "DONE":
        return "Done";
      default:
        return "Unknown";
    }
  },
};
