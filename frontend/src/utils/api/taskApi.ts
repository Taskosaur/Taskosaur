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

// UUID validation (accepts v4 UUIDs with/without hyphens)
import validator from "validator";

function isValidUUID(id: string) {
  // Use strict v4 UUID validation from validator library
  return validator.isUUID(id, 4);
}

function formatUUID(id: string) {
  if (!id) return id;
  if (id.includes("-")) return id; // already valid
  return id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

// Validate and sanitize slug values to prevent SSRF
function sanitizeSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') {
    throw new Error('Invalid slug: must be a non-empty string');
  }
  // Slugs should only contain alphanumeric, hyphens, underscores, and dots
  // This prevents path traversal and other injection attacks
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) {
    throw new Error('Invalid slug format: contains invalid characters');
  }
  // Prevent path traversal
  if (slug.includes('..') || slug.includes('//')) {
    throw new Error('Invalid slug: path traversal detected');
  }
  return encodeURIComponent(slug);
}

export const taskApi = {
  getTaskStatusByProject: async ({
    projectId,
  }: {
    projectId: string;
  }): Promise<{ data: TaskStatus[] }> => {
    try {
      if (!projectId) {
        throw new Error("projectId is required");
      }
      const response = await api.get<{ data: TaskStatus[] }>(
        `/task-statuses/project?projectId=${projectId}`
      );
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
  createTaskWithAttachements: async (taskData: CreateTaskRequest): Promise<Task> => {
    try {
      const formData = new FormData();

      // Append all task data fields to FormData
      formData.append("title", taskData.title);
      formData.append("projectId", taskData.projectId);
      formData.append("statusId", taskData.statusId);

      // Append optional string fields
      if (taskData.description) {
        formData.append("description", taskData.description);
      }
      if (taskData.type) {
        formData.append("type", taskData.type);
      }
      if (taskData.priority) {
        formData.append("priority", taskData.priority);
      }
      if (taskData.startDate) {
        formData.append("startDate", taskData.startDate);
      }
      if (taskData.dueDate) {
        formData.append("dueDate", taskData.dueDate);
      }
      if (taskData.sprintId) {
        formData.append("sprintId", taskData.sprintId);
      }
      if (taskData.parentTaskId) {
        formData.append("parentTaskId", taskData.parentTaskId);
      }
      if (taskData.completedAt !== undefined) {
        formData.append("completedAt", taskData.completedAt || "");
      }

      // Append number fields
      if (taskData.storyPoints !== undefined) {
        formData.append("storyPoints", taskData.storyPoints.toString());
      }
      if (taskData.originalEstimate !== undefined) {
        formData.append("originalEstimate", taskData.originalEstimate.toString());
      }
      if (taskData.remainingEstimate !== undefined) {
        formData.append("remainingEstimate", taskData.remainingEstimate.toString());
      }

      // Append array fields as JSON strings
      if (taskData.assigneeIds && taskData.assigneeIds.length > 0) {
        formData.append("assigneeIds", JSON.stringify(taskData.assigneeIds));
      }
      if (taskData.reporterIds && taskData.reporterIds.length > 0) {
        formData.append("reporterIds", JSON.stringify(taskData.reporterIds));
      }

      // Append custom fields as JSON string
      if (taskData.customFields) {
        formData.append("customFields", JSON.stringify(taskData.customFields));
      }

      // Append files
      if (taskData.attachments && taskData.attachments.length > 0) {
        taskData.attachments.forEach((file) => {
          formData.append("attachments", file);
        });
      }

      const response = await api.post<Task>("/tasks/create-task-attachment", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

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
      assignees?: string;
      reporters?: string;
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
      if (params?.assignees) queryParams.append("assigneeIds", params.assignees);
      if (params?.reporters) queryParams.append("reporterIds", params.reporters);

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

  getPublicCalendarTask: async (
    workspaceSlug: string,
    projectSlug: string,
    startDate?: string,
    endDate?: string
  ): Promise<Task[]> => {
    try {
      const queryParams = new URLSearchParams();

      // Optional date filters
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);

      const query = queryParams.toString();
      const url = `/public/workspaces/${workspaceSlug}/projects/${projectSlug}/calendar${
        query ? `?${query}` : ""
      }`;

      const response = await api.get<Task[]>(url);
      return response.data;
    } catch (error) {
      console.error("Get public calendar tasks error:", error);
      throw error;
    }
  },

  getTasksByProject: async (projectId: string, organizationId: string): Promise<Task[]> => {
    try {
      if (!organizationId) {
        throw new Error("organizationId is required");
      }
      const response = await api.get<Task[]>(
        `/tasks?organizationId=${organizationId}&projectId=${projectId}`
      );
      return response.data;
    } catch (error) {
      console.error("Get tasks by project error:", error);
      throw error;
    }
  },

  getPublicProjectTasks: async (
    workspaceSlug: string,
    projectSlug: string,
    filters?: {
      limit?: number;
      page?: number;
      status?: string;
      priority?: string;
      type?: string;
    }
  ): Promise<PaginatedTaskResponse> => {
    try {
      if (!workspaceSlug || !projectSlug) {
        throw new Error("workspaceSlug and projectSlug are required");
      }

      const params = new URLSearchParams();

      if (filters?.limit) params.append("limit", filters.limit.toString());
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.status) params.append("status", filters.status);
      if (filters?.priority) params.append("priority", filters.priority);
      if (filters?.type) params.append("type", filters.type);

      // Sanitize slugs to prevent SSRF
      const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
      const safeProjectSlug = sanitizeSlug(projectSlug);

      const response = await api.get<PaginatedTaskResponse>(
        `/public/project-tasks/${safeWorkspaceSlug}/projects/${safeProjectSlug}/tasks?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("❌ Error fetching public project tasks:", error);
      throw error;
    }
  },
  getTasksBySprint: async (sprintId: string, organizationId: string): Promise<Task[]> => {
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(organizationId)) {
        throw new Error(`Invalid organizationId format: ${organizationId}. Expected UUID format.`);
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append("page", params.page.toString());
      if (params.limit) queryParams.append("limit", params.limit.toString());
      if (params.assigneeId) queryParams.append("assigneeId", params.assigneeId);
      if (params.priority) queryParams.append("priority", params.priority); // ✅ Add priority
      if (params.search) queryParams.append("search", params.search); // ✅ Add search

      const queryString = queryParams.toString();
      const url = `/tasks/organization/${organizationId}${queryString ? `?${queryString}` : ""}`;

      const response = await api.get<TasksResponse>(url);
      return response.data;
    } catch (error) {
      console.error("Get tasks by organization error:", error);
      throw error;
    }
  },

  getSubtasksByParent: async (
    parentTaskId: string,
    isAuth: boolean,
    workspaceSlug?: string,
    projectSlug?: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedTaskResponse> => {
    try {
      const uuid = formatUUID(parentTaskId);

      // Default pagination
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 10;

      let response;
      if (isAuth) {
        // Get organizationId from localStorage (only in browser)
        let organizationId: string | null = null;
        if (typeof window !== "undefined") {
          organizationId = localStorage.getItem("currentOrganizationId");
        }
        if (!organizationId) {
          throw new Error("Organization ID not found in localStorage");
        }

        // Authenticated users: call normal tasks endpoint
        response = await api.get<PaginatedTaskResponse>(
          `/tasks?organizationId=${encodeURIComponent(
            organizationId
          )}&parentTaskId=${encodeURIComponent(uuid)}&page=${page}&limit=${limit}`
        );
      } else {
        // Public users: call public project tasks endpoint
        if (!workspaceSlug || !projectSlug) {
          throw new Error("WorkspaceSlug and ProjectSlug are required for public tasks");
        }

        response = await api.get<PaginatedTaskResponse>(
          `/public/project-tasks/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(
            projectSlug
          )}/tasks?parentTaskId=${encodeURIComponent(uuid)}&page=${page}&limit=${limit}`
        );
      }

      return response.data;
    } catch (error) {
      console.error("Get subtasks by parent error:", error);
      throw error;
    }
  },

  getTasksOnly: async (projectId?: string): Promise<Task[]> => {
    try {
      if (projectId && !isValidUUID(projectId)) {
        throw new Error('Invalid project ID format');
      }
      const query = projectId ? `?projectId=${projectId}&parentTaskId=null` : "?parentTaskId=null";
      const response = await api.get<Task[]>(`/tasks${query}`);
      return response.data;
    } catch (error) {
      console.error("Get tasks only error:", error);
      throw error;
    }
  },

  getSubtasksOnly: async (projectId?: string): Promise<Task[]> => {
    try {
      if (projectId && !isValidUUID(projectId)) {
        throw new Error('Invalid project ID format');
      }
      const baseQuery = projectId ? `?projectId=${projectId}` : "";
      const response = await api.get<Task[]>(`/tasks${baseQuery}`);
      return response.data.filter((task: any) => task.parentTaskId);
    } catch (error) {
      console.error("Get subtasks only error:", error);
      throw error;
    }
  },

  getTaskById: async (taskId: string, isAuth: boolean): Promise<Task> => {
    try {
      if (!isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      let response;
      if (isAuth) {
        response = await api.get<Task>(`/tasks/${encodeURIComponent(taskId)}`);
      } else {
        response = await api.get<Task>(`/public/project-tasks/${encodeURIComponent(taskId)}`);
      }
      return response.data;
    } catch (error) {
      console.error("Get task by ID error:", error);
      throw error;
    }
  },

  updateTask: async (taskId: string, taskData: UpdateTaskRequest): Promise<Task> => {
    try {
      if (!isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      const response = await api.patch<Task>(`/tasks/${encodeURIComponent(taskId)}`, taskData);
      return response.data;
    } catch (error) {
      console.error("Update task error:", error);
      throw error;
    }
  },

  deleteTask: async (taskId: string): Promise<void> => {
    try {
      if (!isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      await api.delete(`/tasks/${encodeURIComponent(taskId)}`);
    } catch (error) {
      console.error("Delete task error:", error);
      throw error;
    }
  },

  getAllTaskStatuses: async (params?: {
    workflowId?: string;
    organizationId?: string;
  }): Promise<TaskStatus[]> => {
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

  getTaskActivity: async (
    taskId: string,
    isAuth: boolean,
    page: number = 1,
    limit: number = 10
  ): Promise<any> => {
    try {
      if (!isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      let response;
      if (isAuth) {
        response = await api.get<Task[]>(
          `/activity-logs/task/${encodeURIComponent(taskId)}/activities?limit=${limit}&page=${page}`
        );
      } else {
        response = await api.get<Task[]>(
          `/public/project-tasks/activities/${encodeURIComponent(taskId)}?limit=${limit}&page=${page}`
        );
      }
      return response.data;
    } catch (error) {
      console.error("Get tasks by workspace error:", error);
      throw error;
    }
  },

  getTasksByWorkspace: async (workspaceId: string): Promise<Task[]> => {
    try {
      if (!isValidUUID(workspaceId)) {
        throw new Error('Invalid workspace ID format');
      }
      const response = await api.get<Task[]>(`/tasks?workspaceId=${encodeURIComponent(workspaceId)}`);
      return response.data;
    } catch (error) {
      console.error("Get tasks by workspace error:", error);
      throw error;
    }
  },

  // Task Comment operations
  createTaskComment: async (commentData: CreateTaskCommentRequest): Promise<TaskComment> => {
    try {
      const response = await api.post<TaskComment>("/task-comments", commentData);
      return response.data;
    } catch (error) {
      console.error("Create task comment error:", error);
      throw error;
    }
  },

  getTaskComments: async (taskId: string, isAuth: boolean): Promise<TaskComment[]> => {
    try {
      if (!isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      let response;
      if (isAuth) {
        response = await api.get<TaskComment[]>(`/task-comments?taskId=${encodeURIComponent(taskId)}`);
      } else {
        response = await api.get<TaskComment[]>(`/public/project-tasks/comments/${encodeURIComponent(taskId)}`);
      }
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
      if (!isValidUUID(commentId)) {
        throw new Error('Invalid comment ID format');
      }
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }
      const response = await api.patch<TaskComment>(
        `/task-comments/${encodeURIComponent(commentId)}?userId=${encodeURIComponent(userId)}`,
        commentData
      );
      return response.data;
    } catch (error) {
      console.error("Update task comment error:", error);
      throw error;
    }
  },

  deleteTaskComment: async (commentId: string, userId: string): Promise<void> => {
    try {
      if (!isValidUUID(commentId)) {
        throw new Error('Invalid comment ID format');
      }
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }
      await api.delete(`/task-comments/${encodeURIComponent(commentId)}?userId=${encodeURIComponent(userId)}`);
    } catch (error) {
      console.error("Delete task comment error:", error);
      throw error;
    }
  },

  // Task Attachment operations
  uploadAttachment: async (taskId: string, file: File): Promise<TaskAttachment> => {
    if (!isValidUUID(taskId)) {
      throw new Error("Invalid taskId format. Expected a UUID.");
    }
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use the specialized upload endpoint with form data
      const response = await api.post<TaskAttachment>(
        `/task-attachments/upload/${encodeURIComponent(taskId)}`,
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

  createAttachment: async (attachmentData: CreateAttachmentRequest): Promise<TaskAttachment> => {
    try {
      const response = await api.post<TaskAttachment>("/task-attachments", attachmentData);
      return response.data;
    } catch (error) {
      console.error("Create attachment error:", error);
      throw error;
    }
  },

  getTaskAttachments: async (taskId: string, isAuth: boolean): Promise<TaskAttachment[]> => {
    // Validate that taskId is a UUID before using in any endpoint
    if (!isValidUUID(taskId)) {
      throw new Error("Invalid taskId format");
    }
    try {
      let response;
      if (isAuth) {
        response = await api.get<TaskAttachment[]>(`/task-attachments/task/${encodeURIComponent(taskId)}`);
      } else {
        response = await api.get<TaskAttachment[]>(`/public/project-tasks/attachments/${encodeURIComponent(taskId)}`);
      }
      return response.data;
    } catch (error) {
      console.error("Get task attachments error:", error);
      throw error;
    }
  },

  getAttachmentById: async (attachmentId: string): Promise<TaskAttachment> => {
    try {
      if (!isValidUUID(attachmentId)) {
        throw new Error('Invalid attachment ID format');
      }
      const response = await api.get<TaskAttachment>(`/task-attachments/${attachmentId}`);
      return response.data;
    } catch (error) {
      console.error("Get attachment by ID error:", error);
      throw error;
    }
  },

  downloadAttachment: async (attachmentId: string): Promise<Blob> => {
    try {
      if (!isValidUUID(attachmentId)) {
        throw new Error('Invalid attachment ID format');
      }
      const response = await api.get(`/task-attachments/${attachmentId}/download`, {
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      console.error("Download attachment error:", error);
      throw error;
    }
  },

  previewFile: async (attachmentId: string): Promise<Blob> => {
    try {
      if (!isValidUUID(attachmentId)) {
        throw new Error('Invalid attachment ID format');
      }
      const response = await api.get(`/task-attachments/${attachmentId}/preview`, {
        responseType: "blob",
      });
      return response.data;
    } catch (error: any) {
      console.error("Preview file error:", error);

      let message = "An unexpected error occurred";
      let status = error?.response?.status || 500;

      // Handle blob-based error (binary response)
      if (error?.response?.data instanceof Blob) {
        try {
          // Convert blob to text → then parse JSON
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          message = json.message || message;
          status = json.statusCode || status;
        } catch {
          // Fallback if parsing fails
          message = "Failed to parse server error response.";
        }
      } else {
        // Normal JSON response
        message = error?.response?.data?.message || error?.message || "Failed to preview file.";
      }

      throw { message, status };
    }
  },

  getAttachmentStats: async (taskId?: string): Promise<AttachmentStats> => {
    try {
      if (taskId && !isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      const query = taskId ? `?taskId=${taskId}` : "";
      const response = await api.get<AttachmentStats>(`/task-attachments/stats${query}`);
      return response.data;
    } catch (error) {
      console.error("Get attachment stats error:", error);
      throw error;
    }
  },

  deleteAttachment: async (attachmentId: string, requestUserId: string): Promise<void> => {
    try {
      if (!isValidUUID(attachmentId)) {
        throw new Error('Invalid attachment ID format');
      }
      if (!isValidUUID(requestUserId)) {
        throw new Error('Invalid user ID format');
      }
      await api.delete(`/task-attachments/${attachmentId}?requestUserId=${requestUserId}`);
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
      if (!isValidUUID(projectId)) {
        throw new Error('Invalid project ID format');
      }
      const response = await api.get<TaskLabel[]>(`/labels?projectId=${projectId}`);
      return response.data;
    } catch (error) {
      console.error("Get project labels error:", error);
      throw error;
    }
  },

  getLabelById: async (labelId: string): Promise<TaskLabel> => {
    try {
      if (!isValidUUID(labelId)) {
        throw new Error('Invalid label ID format');
      }
      const response = await api.get<TaskLabel>(`/labels/${labelId}`);
      return response.data;
    } catch (error) {
      console.error("Get label by ID error:", error);
      throw error;
    }
  },

  updateLabel: async (labelId: string, labelData: UpdateLabelRequest): Promise<TaskLabel> => {
    try {
      if (!isValidUUID(labelId)) {
        throw new Error('Invalid label ID format');
      }
      const response = await api.patch<TaskLabel>(`/labels/${labelId}`, labelData);
      return response.data;
    } catch (error) {
      console.error("Update label error:", error);
      throw error;
    }
  },

  deleteLabel: async (labelId: string): Promise<void> => {
    try {
      if (!isValidUUID(labelId)) {
        throw new Error('Invalid label ID format');
      }
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

  assignMultipleLabelsToTask: async (assignData: AssignMultipleLabelsRequest): Promise<void> => {
    try {
      await api.post("/task-labels/assign-multiple", assignData);
    } catch (error) {
      console.error("Assign multiple labels to task error:", error);
      throw error;
    }
  },

  removeLabelFromTask: async (taskId: string, labelId: string): Promise<void> => {
    try {
      if (!isValidUUID(taskId) || !isValidUUID(labelId)) {
        throw new Error("Invalid taskId or labelId");
      }
      await api.delete(`/task-labels/${encodeURIComponent(taskId)}/${encodeURIComponent(labelId)}`);
    } catch (error) {
      console.error("Remove label from task error:", error);
      throw error;
    }
  },

  getTaskLabels: async (taskId: string): Promise<TaskLabel[]> => {
    try {
      if (!isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      const response = await api.get<TaskLabel[]>(`/task-labels?taskId=${taskId}`);
      return response.data;
    } catch (error) {
      console.error("Get task labels error:", error);
      throw error;
    }
  },

  searchLabels: async (projectId: string, query: string): Promise<TaskLabel[]> => {
    try {
      if (!isValidUUID(projectId)) {
        throw new Error('Invalid project ID format');
      }
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(organizationId)) {
        throw new Error(`Invalid organizationId format: ${organizationId}. Expected UUID format.`);
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
    slug: string;
    statusId?: string;
    sprintId?: string;
    page?: number;
    limit?: number;
    includeSubtasks?: boolean;
  }): Promise<any> => {
    try {
      const query = new URLSearchParams();
      query.append("slug", params.slug);
      if (params.statusId) {
        query.append("statusId", params.statusId);
      }
      if (params.sprintId) {
        query.append("sprintId", params.sprintId);
      }
      if (params.page !== undefined) {
        query.append("page", String(params.page));
      }
      if (params.limit !== undefined) {
        query.append("limit", String(params.limit));
      }
      if (params.includeSubtasks !== undefined) {
        query.append("includeSubtasks", String(params.includeSubtasks));
      }
      const response = await api.get(`/tasks/by-status?${query.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Get task kanban status error:", error);
      throw error;
    }
  },

  updateTaskStatus: async (taskId: string, statusId: string): Promise<Task> => {
    try {
      if (!isValidUUID(taskId)) {
        throw new Error('Invalid task ID format');
      }
      if (!isValidUUID(statusId)) {
        throw new Error('Invalid status ID format');
      }
      const response = await api.patch<Task>(`/tasks/${encodeURIComponent(taskId)}/status`, {
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
        throw new Error(error.response.data.message || "Invalid request parameters");
      }
      console.error("Get filtered tasks error:", error);
      throw error;
    }
  },

    // Validate and format UUID using strict v4 check
  assignTaskAssignees: async (taskId: string, assigneeIds: string[]) => {
    if (!isValidUUID(taskId)) {
      throw new Error("Invalid taskId provided. Must be a valid v4 UUID.");
    }

    // Always use canonical hyphenated UUID form for safety
    const safeTaskId = taskId.includes("-") ? taskId : [
      taskId.slice(0, 8),
      taskId.slice(8, 12),
      taskId.slice(12, 16),
      taskId.slice(16, 20),
      taskId.slice(20, 32),
    ].join("-");

    try {
      const response = await api.patch(`/tasks/${encodeURIComponent(safeTaskId)}/assignees`, {
        assigneeIds,
      });
      return response.data;
    } catch (error) {
      console.error("Assign task assignees error:", error);
      throw error;
    }
  },

  bulkDeleteTasks: async (
    taskIds: string[],
    projectId?: string,
    allDelete?: boolean
  ): Promise<{
    deletedCount: number;
    failedTasks: Array<{ id: string; reason: string }>;
  }> => {
    try {
      const response = await api.request<{
        deletedCount: number;
        failedTasks: Array<{ id: string; reason: string }>;
      }>({
        url: `/tasks/bulk-delete`,
        method: "POST",
        data: { taskIds, projectId, all: allDelete },
      });

      return response.data;
    } catch (error: any) {
      console.error("Bulk delete tasks error:", error?.response || error);
      throw error;
    }
  },
};
