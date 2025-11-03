import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { taskApi } from "@/utils/api/taskApi";
import {
  getCurrentOrganizationId,
  getCurrentWorkspaceId,
  getCurrentProjectId,
} from "@/utils/hierarchyContext";
import {
  Task,
  CreateTaskRequest,
  CreateSubtaskRequest,
  UpdateTaskRequest,
  TaskStatus,
  TaskComment,
  CreateTaskCommentRequest,
  UpdateTaskCommentRequest,
  TaskAttachment,
  CreateAttachmentRequest,
  AttachmentStats,
  TaskLabel,
  CreateLabelRequest,
  UpdateLabelRequest,
  AssignLabelRequest,
  AssignMultipleLabelsRequest,
  GetTasksParams,
  TasksResponse,
  TaskActivityType,
  ActivityApiResponse,
  PaginatedTaskResponse,
} from "@/types";
interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  subtTask: Task[];
  taskComments: TaskComment[];
  taskAttachments: TaskAttachment[];
  taskLabels: TaskLabel[];
  taskStatuses: TaskStatus[];
  isLoading: boolean;
  error: string | null;
  taskResponse: PaginatedTaskResponse;
  subtaskPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null;
}

interface TaskContextType extends TaskState {
  getCalendarTask: (
    organizationId: string,
    params?: {
      workspaceId?: string;
      projectId?: string;
      sprintId?: string;
      priorities?: string;
      statuses?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) => Promise<Task[]>;

  getPublicCalendarTask: (
    workspaceSlug: string,
    projectSlug: string,
    startDate?: string,
    endDate?: string
  ) => Promise<Task[]>;

  getTaskStatusByProject: (params: { projectId: string }) => Promise<{ data: TaskStatus[] }>;

  getFilteredTasks: (params: {
    projectId?: string;
    sprintId?: string;
    workspaceId?: string;
    parentTaskId?: string;
    statuses?: string[];
    search?: string;
    priorities?: ("LOW" | "MEDIUM" | "HIGH" | "HIGHEST")[];
  }) => Promise<PaginatedTaskResponse>;

  updateTaskStatus: (taskId: string, statusId: string) => Promise<Task>;
  getTaskKanbanStatus: (params: {
    slug: string;
    statusId?: string;
    sprintId?: string;
    page?: number;
    limit?: number;
    includeSubtasks?: boolean;
  }) => Promise<any>;
  // Task operations
  createTask: (taskData: CreateTaskRequest) => Promise<Task>;
  createTaskWithAttachements: (taskData: CreateTaskRequest) => Promise<Task>;

  createSubtask: (subtaskData: CreateSubtaskRequest) => Promise<Task>;
  getAllTasks: (
    organizationId: string,
    params?: {
      workspaceId?: string;
      projectId?: string;
      priorities?: string;
      statuses?: string;
      assignees?: string;
      reporters?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) => Promise<PaginatedTaskResponse>;
  getTasksByOrganization: (
    organizationId?: string,
    params?: GetTasksParams
  ) => Promise<TasksResponse>;
  getTodayAgenda: (organizationId?: string, params?: GetTasksParams) => Promise<TasksResponse>;
  getTasksByProject: (projectId: string, organizationId: string) => Promise<Task[]>;
  getPublicProjectTasks: (
    workspaceSlug: string,
    projectSlug: string,
    filters?: {
      limit?: number;
      page?: number;
      status?: string;
      priority?: string;
      type?: string;
    }
  ) => Promise<PaginatedTaskResponse>;
  getTasksBySprint: (organizationId: string, sprintId: string) => Promise<Task[]>;
  getSubtasksByParent: (
    parentTaskId: string,
    isAuth: boolean,
    workspaceSlug?: string,
    projectSlug?: string,
    options?: { page?: number; limit?: number }
  ) => Promise<PaginatedTaskResponse>;
  getTasksOnly: (projectId?: string) => Promise<Task[]>;
  getSubtasksOnly: (projectId?: string) => Promise<Task[]>;
  getTaskById: (taskId: string, isAuth: boolean) => Promise<Task>;
  updateTask: (taskId: string, taskData: UpdateTaskRequest) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  bulkDeleteTasks: (
    taskIds: string[],
    projectId?: string,
    allDelete?: boolean
  ) => Promise<{
    deletedCount: number;
    failedTasks: Array<{ id: string; reason: string }>;
  }>;
  getTaskActivity: (
    taskId: string,
    isAth: boolean,
    pageNum: number
  ) => Promise<ActivityApiResponse>;
  getAllTaskStatuses: (params?: {
    workflowId?: string;
    organizationId?: string;
  }) => Promise<TaskStatus[]>;
  getTasksByWorkspace: (workspaceId: string) => Promise<Task[]>;

  // Enhanced methods with automatic hierarchy context
  getCurrentTasks: () => Promise<Task[]>; // Uses current project context
  getCurrentOrganizationTasks: (params?: GetTasksParams) => Promise<TasksResponse>; // Uses current organization
  getCurrentWorkspaceTasks: () => Promise<Task[]>; // Uses current workspace
  getCurrentProjectLabels: () => Promise<TaskLabel[]>; // Uses current project

  // Task comment operations
  createTaskComment: (commentData: CreateTaskCommentRequest) => Promise<TaskComment>;
  getTaskComments: (taskId: string, isAuth: boolean) => Promise<TaskComment[]>;
  updateTaskComment: (
    commentId: string,
    userId: string,
    commentData: UpdateTaskCommentRequest
  ) => Promise<TaskComment>;
  deleteTaskComment: (commentId: string, userId: string) => Promise<void>;

  // Task attachment operations
  uploadAttachment: (taskId: string, file: File) => Promise<TaskAttachment>;
  createAttachment: (attachmentData: CreateAttachmentRequest) => Promise<TaskAttachment>;
  getTaskAttachments: (taskId: string, isAuth: boolean) => Promise<TaskAttachment[]>;
  getAttachmentById: (attachmentId: string) => Promise<TaskAttachment>;
  downloadAttachment: (attachmentId: string) => Promise<Blob>;
  previewFile: (attachmentId: string) => Promise<Blob>;
  getAttachmentStats: (taskId?: string) => Promise<AttachmentStats>;
  deleteAttachment: (attachmentId: string, requestUserId: string) => Promise<void>;

  // Task label operations
  createLabel: (labelData: CreateLabelRequest) => Promise<TaskLabel>;
  getProjectLabels: (projectId: string) => Promise<TaskLabel[]>;
  getLabelById: (labelId: string) => Promise<TaskLabel>;
  updateLabel: (labelId: string, labelData: UpdateLabelRequest) => Promise<TaskLabel>;
  deleteLabel: (labelId: string) => Promise<void>;
  assignLabelToTask: (assignData: AssignLabelRequest) => Promise<void>;
  assignMultipleLabelsToTask: (assignData: AssignMultipleLabelsRequest) => Promise<void>;
  removeLabelFromTask: (taskId: string, labelId: string) => Promise<void>;
  getTaskLabels: (taskId: string) => Promise<TaskLabel[]>;
  searchLabels: (projectId: string, query: string) => Promise<TaskLabel[]>;

  // State management
  setCurrentTask: (task: Task | null) => void;
  refreshTasks: (projectId?: string) => Promise<void>;
  refreshTaskComments: (taskId: string, isAuth: boolean) => Promise<void>;
  refreshTaskAttachments: (taskId: string, isAuth: boolean) => Promise<void>;
  refreshTaskLabels: (taskId: string) => Promise<void>;
  clearError: () => void;

  // Helper methods
  getTasksByStatus: (statusId: string) => Task[];
  getTasksByPriority: (priority: Task["priority"]) => Task[];
  isTaskOverdue: (task: Task) => boolean;
  updateSubtask: (subtaskId: string, subtaskData: UpdateTaskRequest) => Promise<Task>;
  deleteSubtask: (subtaskId: string) => Promise<void>;

  // Add assignTaskAssignees to context type
  assignTaskAssignees: (taskId: string, assigneeIds: string[]) => Promise<any>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTask = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTask must be used within a TaskProvider");
  }
  return context;
};

interface TaskProviderProps {
  children: React.ReactNode;
}

export function TaskProvider({ children }: TaskProviderProps) {
  const [taskState, setTaskState] = useState<TaskState>({
    tasks: [],
    currentTask: null,
    subtTask: [],
    taskComments: [],
    taskAttachments: [],
    taskLabels: [],
    taskStatuses: [],
    isLoading: false,
    error: null,
    taskResponse: null,
    subtaskPagination: null,
  });

  // Helper to handle API operations with error handling
  const handleApiOperation = useCallback(async function <T>(
    operation: () => Promise<T>,
    loadingState: boolean = true
  ): Promise<T> {
    try {
      if (loadingState) {
        setTaskState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      const result = await operation();

      if (loadingState) {
        setTaskState((prev) => ({ ...prev, isLoading: false }));
      }

      return result;
    } catch (error) {
      const errorMessage = error?.message ? error.message : "An error occurred";
      setTaskState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      ...taskState,
      getTaskStatusByProject: async (params: {
        projectId: string;
      }): Promise<{ data: TaskStatus[] }> => {
        if (!params.projectId) {
          throw new Error("No projectId provided for getTaskStatusByProject");
        }
        return await handleApiOperation(() => taskApi.getTaskStatusByProject(params), false);
      },

      getFilteredTasks: async (params: {
        projectId?: string;
        sprintId?: string;
        workspaceId?: string;
        parentTaskId?: string;
        statuses?: string[];
        search?: string;
        priorities?: ("LOW" | "MEDIUM" | "HIGH" | "HIGHEST")[];
      }): Promise<PaginatedTaskResponse> => {
        const organizationId =
          localStorage.getItem("currentOrganizationId") || taskApi.getCurrentOrganization();
        if (!organizationId) {
          throw new Error("No organization selected. Please select an organization first.");
        }

        const result = await handleApiOperation(
          () =>
            taskApi.getFilteredTasks({
              organizationId,
              projectId: params.projectId,
              sprintId: params.sprintId,
              workspaceId: params.workspaceId,
              parentTaskId: params.parentTaskId,
              statuses: params.statuses,
              search: params.search,
              priorities: params.priorities,
            }),
          false
        );

        // Only update the task state if we're not filtering by parent task
        // This prevents overwriting the main task list with subtasks
        if (!params.parentTaskId) {
          setTaskState((prev) => ({
            ...prev,
            tasks: result.data,
          }));
        }

        return result;
      },
      getTaskKanbanStatus: async (params: {
        slug: string;
        statusId?: string;
        sprintId?: string;
        page?: number;
        limit?: number;
        includeSubtasks?: boolean;
      }): Promise<any> => {
        const result = await handleApiOperation(() => taskApi.getTaskKanbanStatus(params), false);
        return result;
      },

      createTask: async (taskData: CreateTaskRequest): Promise<Task> => {
        const result = await handleApiOperation(() => taskApi.createTask(taskData));

        // Add new task to state if it's not a subtask
        if (!result.parentTaskId) {
          setTaskState((prev) => ({
            ...prev,
            tasks: [...prev.tasks, result],
          }));
        }

        return result;
      },
      createTaskWithAttachements: async (taskData: CreateTaskRequest): Promise<Task> => {
        const result = await handleApiOperation(() => taskApi.createTaskWithAttachements(taskData));

        // Add new task to state if it's not a subtask
        if (!result.parentTaskId) {
          setTaskState((prev) => ({
            ...prev,
            tasks: [...prev.tasks, result],
          }));
        }

        return result;
      },
      createSubtask: async (subtaskData: CreateSubtaskRequest): Promise<Task> => {
        const result = await taskApi.createSubtask(subtaskData);
        setTaskState((prev) => {
          const updatedSubtasks = [...prev.subtTask, result];
          const updatedCurrentTask =
            prev.currentTask?.id === subtaskData.parentTaskId
              ? {
                  ...prev.currentTask,
                  subtasks: [...(prev.currentTask?.childTasks || []), result],
                }
              : prev.currentTask;

          return {
            ...prev,
            subtTask: updatedSubtasks,
            currentTask: updatedCurrentTask,
          };
        });
        return result;
      },
      updateSubtask: async (subtaskId: string, subtaskData: UpdateTaskRequest): Promise<Task> => {
        const result = await taskApi.updateTask(subtaskId, subtaskData);

        setTaskState((prev) => {
          // Update subtask in subtTask array
          const updatedSubtasks = prev.subtTask.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, ...result } : subtask
          );
          const updatedCurrentTask = prev.currentTask?.childTasks?.some(
            (child) => child.id === subtaskId
          )
            ? {
                ...prev.currentTask,
                childTasks: prev.currentTask.childTasks.map((child) =>
                  child.id === subtaskId ? { ...child, ...result } : child
                ),
              }
            : prev.currentTask;

          return {
            ...prev,
            subtTask: updatedSubtasks,
            currentTask: updatedCurrentTask,
          };
        });

        return result;
      },

      deleteSubtask: async (subtaskId: string): Promise<void> => {
        await taskApi.deleteTask(subtaskId);

        setTaskState((prev) => {
          const updatedSubtasks = prev.subtTask.filter((subtask) => subtask.id !== subtaskId);
          const updatedCurrentTask = prev.currentTask?.childTasks?.some(
            (child) => child.id === subtaskId
          )
            ? {
                ...prev.currentTask,
                childTasks: prev.currentTask.childTasks.filter((child) => child.id !== subtaskId),
              }
            : prev.currentTask;

          return {
            ...prev,
            subtTask: updatedSubtasks,
            currentTask: updatedCurrentTask,
          };
        });
      },
      getAllTasks: async (
        organizationId: string,
        params?: {
          workspaceId?: string;
          projectId?: string;
          priorities?: string;
          statuses?: string;
          assignees?: string;
          reporters?: string;
          search?: string;
          page?: number;
          limit?: number;
        }
      ): Promise<PaginatedTaskResponse> => {
        const result = await taskApi.getAllTasks(organizationId, params);
        setTaskState((prev) => {
          const newState = {
            ...prev,
            tasks: result.data,
            taskResponse: result,
          };
          return newState;
        });
        return result;
      },

      getCalendarTask: async (
        organizationId: string,
        params?: {
          workspaceId?: string;
          projectId?: string;
          sprintId?: string;
          priorities?: string;
          statuses?: string;
          search?: string;
          page?: number;
          limit?: number;
        }
      ): Promise<Task[]> => {
        if (!organizationId) {
          throw new Error("organizationId is required for getCalendarTask");
        }
        const result = await handleApiOperation(
          () => taskApi.getCalendarTask(organizationId, params),
          false
        );
        return Array.isArray(result) ? result : [];
      },

      getPublicCalendarTask: async (
        workspaceSlug: string,
        projectSlug: string,
        startDate?: string,
        endDate?: string
      ): Promise<Task[]> => {
        const result = await handleApiOperation(
          () => taskApi.getPublicCalendarTask(workspaceSlug, projectSlug, startDate, endDate),
          false
        );
        return Array.isArray(result) ? result : [];
      },

      getTasksByProject: async (projectId: string, organizationId: string): Promise<Task[]> => {
        const result = await handleApiOperation(() =>
          taskApi.getTasksByProject(projectId, organizationId)
        );
        setTaskState((prev) => ({
          ...prev,
          tasks: result,
        }));
        return result;
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
        const result = await handleApiOperation(() =>
          taskApi.getPublicProjectTasks(workspaceSlug, projectSlug, filters)
        );

        setTaskState((prev) => {
          const newState = {
            ...prev,
            tasks: result.data,
            taskResponse: result,
          };
          return newState;
        });
        return result;
      },

      getTasksBySprint: async (organizationId: string, sprintId: string): Promise<Task[]> => {
        const result = await handleApiOperation(() =>
          taskApi.getTasksBySprint(sprintId, organizationId)
        );
        setTaskState((prev) => ({
          ...prev,
          tasks: result,
        }));
        return result;
      },

      getSubtasksByParent: async (
        parentTaskId: string,
        isAuth: boolean,
        workspaceSlug?: string,
        projectSlug?: string,
        options?: { page?: number; limit?: number }
      ): Promise<PaginatedTaskResponse> => {
        const result = await handleApiOperation(
          () =>
            taskApi.getSubtasksByParent(parentTaskId, isAuth, workspaceSlug, projectSlug, options),
          false
        );
        setTaskState((prev) => ({
          ...prev,
          subtTask: result.data,
          subtaskPagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        }));
        return result;
      },

      getTasksOnly: (projectId?: string): Promise<Task[]> =>
        handleApiOperation(() => taskApi.getTasksOnly(projectId), false),

      getSubtasksOnly: (projectId?: string): Promise<Task[]> =>
        handleApiOperation(() => taskApi.getSubtasksOnly(projectId), false),

      getTaskById: async (taskId: string, isAuth: boolean): Promise<Task> => {
        const result = await handleApiOperation(() => taskApi.getTaskById(taskId, isAuth), false);

        // Update current task if it's the same ID
        setTaskState((prev) => ({
          ...prev,
          currentTask: result,
        }));

        return result;
      },

      updateTask: async (taskId: string, taskData: UpdateTaskRequest): Promise<Task> => {
        const result = await handleApiOperation(() => taskApi.updateTask(taskId, taskData), false);
        setTaskState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, ...result } : task)),
          subtTask: prev.subtTask.map((subtask) =>
            subtask.id === taskId ? { ...subtask, ...result } : subtask
          ),
          currentTask:
            prev.currentTask?.id === taskId
              ? { ...prev.currentTask, ...result }
              : prev.currentTask?.childTasks?.some((child) => child.id === taskId)
                ? {
                    ...prev.currentTask,
                    childTasks: prev.currentTask.childTasks.map((child) =>
                      child.id === taskId ? { ...child, ...result } : child
                    ),
                  }
                : prev.currentTask,
        }));

        return result;
      },
      deleteTask: async (taskId: string): Promise<void> => {
        await handleApiOperation(() => taskApi.deleteTask(taskId), false);
        setTaskState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((task) => task.id !== taskId),
          subtTask: prev.subtTask.filter((subtask) => subtask.id !== taskId),
          currentTask:
            prev.currentTask?.id === taskId
              ? null
              : prev.currentTask?.childTasks?.some((child) => child.id === taskId)
                ? {
                    ...prev.currentTask,
                    childTasks: prev.currentTask.childTasks.filter((child) => child.id !== taskId),
                  }
                : prev.currentTask,
        }));
      },

      bulkDeleteTasks: async (
        taskIds: string[],
        projectId?: string,
        allDelete?: boolean
      ): Promise<{
        deletedCount: number;
        failedTasks: Array<{ id: string; reason: string }>;
      }> => {
        const result = await handleApiOperation(
          () => taskApi.bulkDeleteTasks(taskIds, projectId, allDelete),
          false
        );

        // Only remove successfully deleted tasks from state
        const successfullyDeletedIds = taskIds.filter(
          (id) => !result.failedTasks.some((failed) => failed.id === id)
        );

        setTaskState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((task) => !successfullyDeletedIds.includes(task.id)),
          subtTask: prev.subtTask.filter((subtask) => !successfullyDeletedIds.includes(subtask.id)),
          currentTask:
            prev.currentTask && successfullyDeletedIds.includes(prev.currentTask.id)
              ? null
              : prev.currentTask?.childTasks
                ? {
                    ...prev.currentTask,
                    childTasks: prev.currentTask.childTasks.filter(
                      (child) => !successfullyDeletedIds.includes(child.id)
                    ),
                  }
                : prev.currentTask,
        }));

        return result;
      },

      updateTaskStatus: async (taskId: string, statusId: string): Promise<Task> => {
        const result = await handleApiOperation(
          () => taskApi.updateTaskStatus(taskId, statusId),
          false
        );
        // Update task in state
        setTaskState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, statusId } : task)),
          currentTask:
            prev.currentTask?.id === taskId ? { ...prev.currentTask, statusId } : prev.currentTask,
        }));
        return result;
      },

      getTaskActivity: async (
        taskId: string,
        isAuth: boolean,
        pageNum: number
      ): Promise<ActivityApiResponse> => {
        const result = await handleApiOperation(
          () => taskApi.getTaskActivity(taskId, isAuth, pageNum),
          false
        );

        setTaskState((prev) => ({
          ...prev,
          taskActivities: result,
        }));

        return result;
      },

      getAllTaskStatuses: async (params?: {
        workflowId?: string;
        organizationId?: string;
      }): Promise<TaskStatus[]> => {
        const result = await handleApiOperation(() => taskApi.getAllTaskStatuses(params), false);

        setTaskState((prev) => ({
          ...prev,
          taskStatuses: result,
        }));

        return result;
      },

      getTasksByWorkspace: (workspaceId: string): Promise<Task[]> =>
        handleApiOperation(() => taskApi.getTasksByWorkspace(workspaceId)),

      // Task comment operations
      createTaskComment: async (commentData: CreateTaskCommentRequest): Promise<TaskComment> => {
        const result = await taskApi.createTaskComment(commentData);

        // Add comment to state if it's for the current task's comments
        if (
          taskState.taskComments.length > 0 &&
          taskState.taskComments.some((c) => c.taskId === commentData.taskId)
        ) {
          setTaskState((prev) => ({
            ...prev,
            taskComments: [...prev.taskComments, result],
          }));
        }

        return result;
      },

      getTaskComments: async (taskId: string, isAuth: boolean): Promise<TaskComment[]> => {
        const result = await taskApi.getTaskComments(taskId, isAuth);

        setTaskState((prev) => ({
          ...prev,
          taskComments: result,
        }));

        return result;
      },

      updateTaskComment: async (
        commentId: string,
        userId: string,
        commentData: UpdateTaskCommentRequest
      ): Promise<TaskComment> => {
        const result = await taskApi.updateTaskComment(commentId, userId, commentData);

        // Update comment in state
        setTaskState((prev) => ({
          ...prev,
          taskComments: prev.taskComments.map((comment) =>
            comment.id === commentId ? { ...comment, ...result } : comment
          ),
        }));

        return result;
      },

      deleteTaskComment: async (commentId: string, userId: string): Promise<void> => {
        await taskApi.deleteTaskComment(commentId, userId);

        // Remove comment from state
        setTaskState((prev) => ({
          ...prev,
          taskComments: prev.taskComments.filter((comment) => comment.id !== commentId),
        }));
      },

      // Task attachment operations
      uploadAttachment: async (taskId: string, file: File): Promise<TaskAttachment> => {
        const result = await taskApi.uploadAttachment(taskId, file);

        // Add attachment to state if it's for the current task's attachments
        if (
          taskState.taskAttachments.length > 0 &&
          taskState.taskAttachments.some((a) => a.taskId === taskId)
        ) {
          setTaskState((prev) => ({
            ...prev,
            taskAttachments: [...prev.taskAttachments, result],
          }));
        }

        return result;
      },

      createAttachment: (attachmentData: CreateAttachmentRequest): Promise<TaskAttachment> =>
        handleApiOperation(() => taskApi.createAttachment(attachmentData), false),

      getTaskAttachments: async (taskId: string, isAuth: boolean): Promise<TaskAttachment[]> => {
        const result = await handleApiOperation(
          () => taskApi.getTaskAttachments(taskId, isAuth),
          false
        );

        setTaskState((prev) => ({
          ...prev,
          taskAttachments: result,
        }));

        return result;
      },

      getAttachmentById: (attachmentId: string): Promise<TaskAttachment> =>
        handleApiOperation(() => taskApi.getAttachmentById(attachmentId), false),

      downloadAttachment: async (attachmentId: string): Promise<Blob> => {
        return taskApi.downloadAttachment(attachmentId);
      },

      previewFile: async (attachmentId: string): Promise<Blob> => {
        return await taskApi.previewFile(attachmentId);
      },

      getAttachmentStats: (taskId?: string): Promise<AttachmentStats> =>
        handleApiOperation(() => taskApi.getAttachmentStats(taskId), false),

      deleteAttachment: async (attachmentId: string, requestUserId: string): Promise<void> => {
        await handleApiOperation(
          () => taskApi.deleteAttachment(attachmentId, requestUserId),
          false
        );

        // Remove attachment from state
        setTaskState((prev) => ({
          ...prev,
          taskAttachments: prev.taskAttachments.filter(
            (attachment) => attachment.id !== attachmentId
          ),
        }));
      },

      // Task label operations
      createLabel: (labelData: CreateLabelRequest): Promise<TaskLabel> =>
        handleApiOperation(() => taskApi.createLabel(labelData), false),

      getProjectLabels: async (projectId: string): Promise<TaskLabel[]> => {
        const result = await handleApiOperation(() => taskApi.getProjectLabels(projectId), false);

        setTaskState((prev) => ({
          ...prev,
          taskLabels: result,
        }));

        return result;
      },

      getLabelById: (labelId: string): Promise<TaskLabel> =>
        handleApiOperation(() => taskApi.getLabelById(labelId), false),

      updateLabel: (labelId: string, labelData: UpdateLabelRequest): Promise<TaskLabel> =>
        handleApiOperation(() => taskApi.updateLabel(labelId, labelData), false),

      deleteLabel: (labelId: string): Promise<void> =>
        handleApiOperation(() => taskApi.deleteLabel(labelId), false),

      assignLabelToTask: (assignData: AssignLabelRequest): Promise<void> =>
        handleApiOperation(() => taskApi.assignLabelToTask(assignData), false),

      assignMultipleLabelsToTask: (assignData: AssignMultipleLabelsRequest): Promise<void> =>
        handleApiOperation(() => taskApi.assignMultipleLabelsToTask(assignData), false),

      removeLabelFromTask: (taskId: string, labelId: string): Promise<void> =>
        handleApiOperation(() => taskApi.removeLabelFromTask(taskId, labelId), false),

      getTaskLabels: async (taskId: string): Promise<TaskLabel[]> => {
        const result = await handleApiOperation(() => taskApi.getTaskLabels(taskId), false);

        setTaskState((prev) => ({
          ...prev,
          taskLabels: result,
        }));

        return result;
      },

      searchLabels: (projectId: string, query: string): Promise<TaskLabel[]> =>
        handleApiOperation(() => taskApi.searchLabels(projectId, query), false),

      // State management methods
      setCurrentTask: (task: Task | null): void => {
        setTaskState((prev) => ({ ...prev, currentTask: task }));
      },

      refreshTasks: async (projectId?: string): Promise<void> => {
        if (projectId) {
          const organizationId = getCurrentOrganizationId();
          if (!organizationId) {
            throw new Error("No organization selected. Please select an organization first.");
          }
          await contextValue.getTasksByProject(projectId, organizationId);
        } else {
          const organizationId = getCurrentOrganizationId();
          if (!organizationId) {
            throw new Error("No organization selected. Please select an organization first.");
          }
          await contextValue.getAllTasks(organizationId);
        }
      },

      refreshTaskComments: async (taskId: string, isAuth: boolean): Promise<void> => {
        await contextValue.getTaskComments(taskId, isAuth);
      },

      refreshTaskAttachments: async (taskId: string, isAuth: boolean): Promise<void> => {
        await contextValue.getTaskAttachments(taskId, isAuth);
      },

      refreshTaskLabels: async (taskId: string): Promise<void> => {
        await contextValue.getTaskLabels(taskId);
      },

      clearError: (): void => {
        setTaskState((prev) => ({ ...prev, error: null }));
      },

      // Helper methods
      getTasksByStatus: (statusId: string): Task[] => {
        return taskState.tasks.filter((task) => task.statusId === statusId);
      },

      getTasksByPriority: (priority: Task["priority"]): Task[] => {
        return taskState.tasks.filter((task) => task.priority === priority);
      },

      isTaskOverdue: (task: Task): boolean => {
        const now = new Date();
        const dueDate = new Date(task.dueDate);
        return dueDate < now && task.statusId !== "completed"; // Adjust based on your status logic
      },
      getTasksByOrganization: async (
        organizationId?: string,
        params: GetTasksParams = {}
      ): Promise<{
        tasks: Task[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalCount: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }> => {
        const orgId = organizationId || taskApi.getCurrentOrganization();
        if (!orgId) {
          throw new Error("No organization selected. Please select an organization first.");
        }
        const result = await handleApiOperation(() =>
          taskApi.getTasksByOrganization(orgId, params)
        );

        setTaskState((prev) => ({
          ...prev,
          tasks: result.tasks, // ✅ Extract tasks from paginated response
          pagination: result.pagination, // ✅ Store pagination info
        }));

        return result;
      },
      getTodayAgenda: async (
        organizationId?: string,
        params: GetTasksParams = {}
      ): Promise<{
        tasks: Task[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalCount: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }> => {
        const orgId = organizationId || taskApi.getCurrentOrganization();
        if (!orgId) {
          throw new Error("No organization selected. Please select an organization first.");
        }

        const result = await handleApiOperation(() => taskApi.getTodayAgenda(orgId, params));
        return result;
      },

      // Enhanced methods with automatic hierarchy context
      getCurrentTasks: async (): Promise<Task[]> => {
        const projectId = getCurrentProjectId();
        if (!projectId) {
          throw new Error("No project selected. Please select a project first.");
        }
        const organizationId = getCurrentOrganizationId();
        if (!organizationId) {
          throw new Error("No organization selected. Please select an organization first.");
        }
        return await contextValue.getTasksByProject(projectId, organizationId);
      },

      getCurrentOrganizationTasks: async (params?: GetTasksParams): Promise<TasksResponse> => {
        const organizationId = getCurrentOrganizationId();
        if (!organizationId) {
          throw new Error("No organization selected. Please select an organization first.");
        }
        return await contextValue.getTasksByOrganization(organizationId, params);
      },

      getCurrentWorkspaceTasks: async (): Promise<Task[]> => {
        const workspaceId = getCurrentWorkspaceId();
        if (!workspaceId) {
          throw new Error("No workspace selected. Please select a workspace first.");
        }
        return await contextValue.getTasksByWorkspace(workspaceId);
      },

      getCurrentProjectLabels: async (): Promise<TaskLabel[]> => {
        const projectId = getCurrentProjectId();
        if (!projectId) {
          throw new Error("No project selected. Please select a project first.");
        }
        return await contextValue.getProjectLabels(projectId);
      },

      assignTaskAssignees: async (taskId: string, assigneeIds: string[]): Promise<any> => {
        const result = await handleApiOperation(
          () => taskApi.assignTaskAssignees(taskId, assigneeIds),
          false
        );

        setTaskState((prev) => ({
          ...prev,
          currentTask:
            prev.currentTask?.id === taskId
              ? {
                  ...prev.currentTask,
                  assignees: result.assignees || [],
                }
              : prev.currentTask,
          tasks: prev.tasks.map((task) =>
            task.id === taskId ? { ...task, assignees: result.assignees || [] } : task
          ),
        }));

        return result;
      },
    }),
    [taskState, handleApiOperation]
  );

  return <TaskContext.Provider value={contextValue}>{children}</TaskContext.Provider>;
}

export default TaskProvider;

// Export types for components to use
export type {
  Task,
  CreateTaskRequest,
  CreateSubtaskRequest,
  UpdateTaskRequest,
  TaskComment,
  CreateTaskCommentRequest,
  UpdateTaskCommentRequest,
  TaskStatus,
  TaskAttachment,
  CreateAttachmentRequest,
  AttachmentStats,
  TaskLabel,
  CreateLabelRequest,
  UpdateLabelRequest,
  AssignLabelRequest,
  AssignMultipleLabelsRequest,
  TaskActivityType,
};
