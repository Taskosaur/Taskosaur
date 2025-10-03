import api from "@/lib/api";
import {
  AssignLabelRequest,
  AssignMultipleLabelsRequest,
  AttachmentStats,
  CreateAttachmentRequest,
  CreateLabelRequest,
  CreateSubtaskRequest,
  CreateTaskCommentRequest,
  CreateTaskRequest,
  GetTasksParams,
  PaginatedTaskResponse,
  Task,
  TaskAttachment,
  TaskComment,
  TaskLabel,
  TasksResponse,
  TaskStatus,
  UpdateLabelRequest,
  UpdateTaskCommentRequest,
  UpdateTaskRequest,
} from "@/types";

// Task interfaces
function formatUUID(id: string) {
  if (!id) return id;
  if (id.includes("-")) return id; // already valid
  return id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}
export const taskApi = {
  getTaskStatusByProject: async ({ projectId }: { projectId: string }): Promise<{ data: TaskStatus[] }> => {
    try {
      if (!projectId) {
        throw new Error("projectId is required");
      }
      const response = await api.get<{ data: TaskStatus[] }>(`/task-statuses/project?projectId=${projectId}`);
      return response.data;
    } catch (error) {
      console.error("Get task statuses by project error:", error);
      throw error;
    }
  },
  // Task CRUD operations
  createTask: async (taskData: CreateTaskRequest): Promise<Task> => {
    try {
      const response = await api.post<Task>("/tasks", taskData);
      return response.data;
    } catch (error) {
      console.error("Create task error:", error);
      throw error;
    }
  },

  createSubtask: async (subtaskData: CreateSubtaskRequest): Promise<Task> => {
    try {
      const response = await api.post<Task>("/tasks", {
        ...subtaskData,
        parentTaskId: formatUUID(subtaskData.parentTaskId),
      });
      return response.data;
    } catch (error) {
      console.error("Create subtask error:", error);
      throw error;
    }
  },

  getAllTasks: async (
    organizationId: string,
    params?: {
      workspaceId?: string;
      projectId?: string;
      sprintId?: string;
      parentTaskId?: string;
      priorities?: string;
      statuses?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedTaskResponse> => {
    try {
      const queryParams = new URLSearchParams();

      // Required org id
      queryParams.append("organizationId", organizationId);

      // Optional filters
      if (params?.workspaceId) queryParams.append("workspaceId", params.workspaceId);
      if (params?.projectId) queryParams.append("projectId", params.projectId);
      if (params?.sprintId) queryParams.append("sprintId", params.sprintId);
      if (params?.parentTaskId) queryParams.append("parentTaskId", params.parentTaskId);
      if (params?.priorities) queryParams.append("priorities", params.priorities);
      if (params?.statuses) queryParams.append("statuses", params.statuses);
      if (params?.search) queryParams.append("search", params.search);

      // Pagination
      if (params?.page !== undefined) queryParams.append("page", String(params.page));
      if (params?.limit !== undefined) queryParams.append("limit", String(params.limit));

      const query = queryParams.toString();
      const url = `/tasks${query ? `?${query}` : ""}`;

      const response = await api.get<PaginatedTaskResponse>(url);
      return response.data;
    } catch (error) {
      console.error("Get all tasks error:", error);
      throw error;
    }
  },
  getCalendarTask: async (
    organizationId: string,
    params?: {
      workspaceId?: string;
      projectId?: string;
      sprintId?: string;
      parentTaskId?: string;
      priorities?: string;
      statuses?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<Task[]> => {
    try {
      const queryParams = new URLSearchParams();

      // Required org id
      queryParams.append("organizationId", organizationId);

      // Optional filters
      if (params?.workspaceId) queryParams.append("workspaceId", params.workspaceId);
      if (params?.projectId) queryParams.append("projectId", params.projectId);
      if (params?.sprintId) queryParams.append("sprintId", params.sprintId);
      if (params?.parentTaskId) queryParams.append("parentTaskId", params.parentTaskId);
      if (params?.priorities) queryParams.append("priorities", params.priorities);
      if (params?.statuses) queryParams.append("statuses", params.statuses);
      if (params?.search) queryParams.append("search", params.search);

      // Pagination
      if (params?.page !== undefined) queryParams.append("page", String(params.page));
      if (params?.limit !== undefined) queryParams.append("limit", String(params.limit));

      const query = queryParams.toString();
      const url = `/tasks/all-tasks${query ? `?${query}` : ""}`;

      const response = await api.get<Task[]>(url);
      return response.data;
    } catch (error) {
      console.error("Get all tasks error:", error);
      throw error;
    }
  },

  getTasksByProject: async (projectId: string, organizationId: string): Promise<Task[]> => {
    try {
      if (!organizationId) {
        throw new Error("organizationId is required");
      }
      const response = await api.get<Task[]>(`/tasks?organizationId=${organizationId}&projectId=${projectId}`);
      return response.data;
    } catch (error) {
      console.error("Get tasks by project error:", error);
      throw error;
    }
  },
  getTasksBySprint: async (
    sprintId: string,
    organizationId: string
  ): Promise<Task[]> => {
    try {
      if (!sprintId || typeof sprintId !== "string") {
        throw new Error(`Invalid sprintId: ${sprintId}`);
      }
      if (!organizationId || typeof organizationId !== "string") {
        throw new Error(`Invalid organizationId: ${organizationId}`);
      }
      const response = await api.get<Task[]>(
        `/tasks?sprintId=${sprintId}&organizationId=${organizationId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get tasks by sprint error:", error);
      throw error;
    }
  },

  getTasksByOrganization: async (
    organizationId: string,
    params: GetTasksParams = {}
  ): Promise<TasksResponse> => {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(organizationId)) {
        throw new Error(
          `Invalid organizationId format: ${organizationId}. Expected UUID format.`
        );
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append("page", params.page.toString());
      if (params.limit) queryParams.append("limit", params.limit.toString());
      if (params.assigneeId)
        queryParams.append("assigneeId", params.assigneeId);
      if (params.priority) queryParams.append("priority", params.priority); // ✅ Add priority
      if (params.search) queryParams.append("search", params.search); // ✅ Add search

      const queryString = queryParams.toString();
      const url = `/tasks/organization/${organizationId}${queryString ? `?${queryString}` : ""
        }`;

      const response = await api.get<TasksResponse>(url);
      return response.data;
    } catch (error) {
      console.error("Get tasks by organization error:", error);
      throw error;
    }
  },

  getSubtasksByParent: async (
    parentTaskId: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedTaskResponse> => {
    try {
      const uuid = formatUUID(parentTaskId);

      let organizationId: string | null = null;
      if (typeof window !== "undefined") {
        organizationId = localStorage.getItem("currentOrganizationId");
      }
      if (!organizationId) {
        throw new Error("Organization ID not found in localStorage");
      }

      // default pagination values
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 10;

      const response = await api.get<PaginatedTaskResponse>(
        `/tasks?organizationId=${encodeURIComponent(organizationId)}&parentTaskId=${encodeURIComponent(
          uuid
        )}&page=${page}&limit=${limit}`
      );

      return response.data;
    } catch (error) {
      console.error("Get subtasks by parent error:", error);
      throw error;
    }
  },


  getTasksOnly: async (projectId?: string): Promise<Task[]> => {
    try {
      const query = projectId
        ? `?projectId=${projectId}&parentTaskId=null`
        : "?parentTaskId=null";
      const response = await api.get<Task[]>(`/tasks${query}`);
      return response.data;
    } catch (error) {
      console.error("Get tasks only error:", error);
      throw error;
    }
  },

  getSubtasksOnly: async (projectId?: string): Promise<Task[]> => {
    try {
      const baseQuery = projectId ? `?projectId=${projectId}` : "";
      const response = await api.get<Task[]>(`/tasks${baseQuery}`);
      return response.data.filter((task: any) => task.parentTaskId);
    } catch (error) {
      console.error("Get subtasks only error:", error);
      throw error;
    }
  },

  getTaskById: async (taskId: string): Promise<Task> => {
    try {
      const response = await api.get<Task>(`/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      console.error("Get task by ID error:", error);
      throw error;
    }
  },

  updateTask: async (
    taskId: string,
    taskData: UpdateTaskRequest
  ): Promise<Task> => {
    try {
      const response = await api.patch<Task>(`/tasks/${taskId}`, taskData);
      return response.data;
    } catch (error) {
      console.error("Update task error:", error);
      throw error;
    }
  },

  deleteTask: async (taskId: string): Promise<void> => {
    try {
      await api.delete(`/tasks/${taskId}`);
    } catch (error) {
      console.error("Delete task error:", error);
      throw error;
    }
  },

  getAllTaskStatuses: async (params?: { workflowId?: string; organizationId?: string }): Promise<TaskStatus[]> => {
    try {
      let query = "";
      if (params) {
        const queryParams = new URLSearchParams();
        if (params.workflowId) queryParams.append("workflowId", params.workflowId);
        if (params.organizationId) queryParams.append("organizationId", params.organizationId);
        query = queryParams.toString();
      }
      const url = `/task-statuses${query ? `?${query}` : ""}`;
      const response = await api.get<TaskStatus[]>(url);
      return response.data;
    } catch (error) {
      console.error("Get task statuses error:", error);
      throw error;
    }
  },

  getTaskActivity: async (taskId: string, page: number = 1, limit: number = 10): Promise<any> => {
    try {
      const response = await api.get<Task[]>(
        `/activity-logs/task/${taskId}/activities?limit=${limit}&page=${page}`
      );
      return response.data;
    } catch (error) {
      console.error("Get tasks by workspace error:", error);
      throw error;
    }
  },

  getTasksByWorkspace: async (workspaceId: string): Promise<Task[]> => {
    try {
      const response = await api.get<Task[]>(
        `/tasks?workspaceId=${workspaceId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get tasks by workspace error:", error);
      throw error;
    }
  },

  // Task Comment operations
  createTaskComment: async (
    commentData: CreateTaskCommentRequest
  ): Promise<TaskComment> => {
    try {
      const response = await api.post<TaskComment>(
        "/task-comments",
        commentData
      );
      return response.data;
    } catch (error) {
      console.error("Create task comment error:", error);
      throw error;
    }
  },

  getTaskComments: async (taskId: string): Promise<TaskComment[]> => {
    try {
      const response = await api.get<TaskComment[]>(
        `/task-comments?taskId=${taskId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get task comments error:", error);
      throw error;
    }
  },

  updateTaskComment: async (
    commentId: string,
    userId: string,
    commentData: UpdateTaskCommentRequest
  ): Promise<TaskComment> => {
    try {
      const response = await api.patch<TaskComment>(
        `/task-comments/${commentId}?userId=${userId}`,
        commentData
      );
      return response.data;
    } catch (error) {
      console.error("Update task comment error:", error);
      throw error;
    }
  },

  deleteTaskComment: async (
    commentId: string,
    userId: string
  ): Promise<void> => {
    try {
      await api.delete(`/task-comments/${commentId}?userId=${userId}`);
    } catch (error) {
      console.error("Delete task comment error:", error);
      throw error;
    }
  },

  // Task Attachment operations
  uploadAttachment: async (
    taskId: string,
    file: File
  ): Promise<TaskAttachment> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use the specialized upload endpoint with form data
      const response = await api.post<TaskAttachment>(
        `/task-attachments/upload/${taskId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Upload attachment error:", error);
      throw error;
    }
  },

  createAttachment: async (
    attachmentData: CreateAttachmentRequest
  ): Promise<TaskAttachment> => {
    try {
      const response = await api.post<TaskAttachment>(
        "/task-attachments",
        attachmentData
      );
      return response.data;
    } catch (error) {
      console.error("Create attachment error:", error);
      throw error;
    }
  },

  getTaskAttachments: async (taskId: string): Promise<TaskAttachment[]> => {
    try {
      const response = await api.get<TaskAttachment[]>(
        `/task-attachments/task/${taskId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get task attachments error:", error);
      throw error;
    }
  },

  getAttachmentById: async (attachmentId: string): Promise<TaskAttachment> => {
    try {
      const response = await api.get<TaskAttachment>(
        `/task-attachments/${attachmentId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get attachment by ID error:", error);
      throw error;
    }
  },

  downloadAttachment: async (attachmentId: string): Promise<Blob> => {
    try {
      const response = await api.get(
        `/task-attachments/${attachmentId}/download`,
        {
          responseType: "blob",
        }
      );
      return response.data;
    } catch (error) {
      console.error("Download attachment error:", error);
      throw error;
    }
  },

  previewFile: async (attachmentId: string): Promise<Blob> => {
    try {
      const response = await api.get(
        `/task-attachments/${attachmentId}/preview`,
        {
          responseType: "blob",
        }
      );
      return response.data;
    } catch (error) {
      console.error("Preview file error:", error);
      throw error;
    }
  },

  getAttachmentStats: async (taskId?: string): Promise<AttachmentStats> => {
    try {
      const query = taskId ? `?taskId=${taskId}` : "";
      const response = await api.get<AttachmentStats>(
        `/task-attachments/stats${query}`
      );
      return response.data;
    } catch (error) {
      console.error("Get attachment stats error:", error);
      throw error;
    }
  },

  deleteAttachment: async (
    attachmentId: string,
    requestUserId: string
  ): Promise<void> => {
    try {
      await api.delete(
        `/task-attachments/${attachmentId}?requestUserId=${requestUserId}`
      );
    } catch (error) {
      console.error("Delete attachment error:", error);
      throw error;
    }
  },

  // Task Label operations
  createLabel: async (labelData: CreateLabelRequest): Promise<TaskLabel> => {
    try {
      const response = await api.post<TaskLabel>("/labels", labelData);
      return response.data;
    } catch (error) {
      console.error("Create label error:", error);
      throw error;
    }
  },

  getProjectLabels: async (projectId: string): Promise<TaskLabel[]> => {
    try {
      const response = await api.get<TaskLabel[]>(
        `/labels?projectId=${projectId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get project labels error:", error);
      throw error;
    }
  },

  getLabelById: async (labelId: string): Promise<TaskLabel> => {
    try {
      const response = await api.get<TaskLabel>(`/labels/${labelId}`);
      return response.data;
    } catch (error) {
      console.error("Get label by ID error:", error);
      throw error;
    }
  },

  updateLabel: async (
    labelId: string,
    labelData: UpdateLabelRequest
  ): Promise<TaskLabel> => {
    try {
      const response = await api.patch<TaskLabel>(
        `/labels/${labelId}`,
        labelData
      );
      return response.data;
    } catch (error) {
      console.error("Update label error:", error);
      throw error;
    }
  },

  deleteLabel: async (labelId: string): Promise<void> => {
    try {
      await api.delete(`/labels/${labelId}`);
    } catch (error) {
      console.error("Delete label error:", error);
      throw error;
    }
  },

  assignLabelToTask: async (assignData: AssignLabelRequest): Promise<void> => {
    try {
      await api.post("/task-labels", assignData);
    } catch (error) {
      console.error("Assign label to task error:", error);
      throw error;
    }
  },

  assignMultipleLabelsToTask: async (
    assignData: AssignMultipleLabelsRequest
  ): Promise<void> => {
    try {
      await api.post("/task-labels/assign-multiple", assignData);
    } catch (error) {
      console.error("Assign multiple labels to task error:", error);
      throw error;
    }
  },

  removeLabelFromTask: async (
    taskId: string,
    labelId: string
  ): Promise<void> => {
    try {
      await api.delete(`/task-labels/${taskId}/${labelId}`);
    } catch (error) {
      console.error("Remove label from task error:", error);
      throw error;
    }
  },

  getTaskLabels: async (taskId: string): Promise<TaskLabel[]> => {
    try {
      const response = await api.get<TaskLabel[]>(
        `/task-labels?taskId=${taskId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get task labels error:", error);
      throw error;
    }
  },

  searchLabels: async (
    projectId: string,
    query: string
  ): Promise<TaskLabel[]> => {
    try {
      const response = await api.get<TaskLabel[]>(
        `/labels/search?projectId=${projectId}&q=${encodeURIComponent(query)}`
      );
      return response.data;
    } catch (error) {
      console.error("Search labels error:", error);
      throw error;
    }
  },
  getCurrentOrganization: (): string | null => {
    try {
      if (typeof window === "undefined") return null;

      const orgId = localStorage.getItem("currentOrganizationId");
      return orgId;
    } catch (error) {
      console.error("Error getting current organization:", error);
      return null;
    }
  },
  getTodayAgenda: async (
    organizationId: string,
    params: GetTasksParams = {}
  ): Promise<TasksResponse> => {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(organizationId)) {
        throw new Error(
          `Invalid organizationId format: ${organizationId}. Expected UUID format.`
        );
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append("page", params.page.toString());
      if (params.limit) queryParams.append("limit", params.limit.toString());

      // Add organization ID as required parameter
      queryParams.append("organizationId", organizationId);

      const queryString = queryParams.toString();
      const url = `/tasks/today?${queryString}`;

      const response = await api.get<TasksResponse>(url);
      return response.data;
    } catch (error) {
      console.error("Get today agenda error:", error);
      throw error;
    }
  },

  getTaskKanbanStatus: async (params: {
    type: "project" | "workspace";
    slug: string;
    userId?: string;
    includeSubtasks?: boolean;
  }): Promise<any> => {
    try {
      const query = new URLSearchParams();
      query.append("type", params.type);
      query.append("slug", params.slug);
      if (params.userId) query.append("userId", params.userId);
      if (typeof params.includeSubtasks !== "undefined")
        query.append("includeSubtasks", String(params.includeSubtasks));
      const response = await api.get(`/tasks/by-status?${query.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Get task kanban status error:", error);
      throw error;
    }
  },

  updateTaskStatus: async (taskId: string, statusId: string): Promise<Task> => {
    try {
      const response = await api.patch<Task>(`/tasks/${taskId}/status`, {
        statusId,
      });
      return response.data;
    } catch (error) {
      console.error("Update task status error:", error);
      throw error;
    }
  },

  // Task filtering operations
  getFilteredTasks: async (params: {
    organizationId: string; // Required parameter
    projectId?: string;
    sprintId?: string;
    workspaceId?: string;
    parentTaskId?: string;
    statuses?: string[];
    search?: string;
    priorities?: ("LOW" | "MEDIUM" | "HIGH" | "HIGHEST")[];
  }): Promise<PaginatedTaskResponse> => {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(params.organizationId)) {
        throw new Error(
          `Invalid organizationId format: ${params.organizationId}. Expected UUID format.`
        );
      }

      const queryParams = new URLSearchParams();

      // Add required organizationId
      queryParams.append("organizationId", params.organizationId);

      if (params.projectId) {
        queryParams.append("projectId", params.projectId);
      }
      if (params.sprintId) {
        queryParams.append("sprintId", params.sprintId);
      }
      if (params.workspaceId) {
        queryParams.append("workspaceId", params.workspaceId);
      }
      if (params.parentTaskId) {
        queryParams.append("parentTaskId", params.parentTaskId);
      }
      if (params.statuses && params.statuses.length > 0) {
        queryParams.append("statuses", params.statuses.join(","));
      }
      if (params.search) {
        queryParams.append("search", params.search);
      }
      if (params.priorities && params.priorities.length > 0) {
        queryParams.append("priorities", params.priorities.join(","));
      }

      const query = queryParams.toString();
      const url = `/tasks${query ? `?${query}` : ""}`;

      const response = await api.get<PaginatedTaskResponse>(url);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        console.error("Invalid request parameters:", error.response.data);
        throw new Error(
          error.response.data.message || "Invalid request parameters"
        );
      }
      console.error("Get filtered tasks error:", error);
      throw error;
    }
  },

  assignTaskAssignees: async (taskId: string, assigneeIds: string[]) => {
    try {
      const response = await api.patch(`/tasks/${taskId}/assignees`, { assigneeIds });
      return response.data;
    } catch (error) {
      console.error("Assign task assignees error:", error);
      throw error;
    }
  },
};
