import type { User } from "./users";
import type { Project } from "./projects";
import type { Sprint } from "./sprint";
import { TaskStatus } from "./task-status";

export type TaskPriority = "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST" | "URGENT";
export type TaskCategory = "TODO" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  type?: TaskType;
  priority: TaskPriority;
  taskNumber?: number;
  slug?: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  storyPoints?: number;
  originalEstimate?: number;
  remainingEstimate?: number;
  customFields?: any;
  projectId?: string;
  assignees?: User[];
  reporters?: User[];
  statusId?: string;
  sprintId?: string;
  parentTaskId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // Email integration fields
  inboxMessageId?: string;
  emailThreadId?: string;
  allowEmailReplies?: boolean;
  project?: Project;
  assignee?: User | null;
  reporter?: User;
  status?: TaskStatus;
  sprint?: Sprint;
  parentTask?: Partial<Task>;
  childTasks?: Task[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  dependsOn?: any;
  timeEntries?: any[];
  _count?: {
    childTasks?: number;
    comments?: number;
    subTasks?: number;
    attachments?: number;
  };
}
export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type PaginatedTaskResponse = PaginationResponse<Task>;
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: number;
  type?: string;
}

export type ActivityType =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_ASSIGNED"
  | "TASK_COMMENTED"
  | "TASK_LABEL_ADDED"
  | "TASK_LABEL_REMOVED"
  | "TASK_STATUS_CHANGED"
  | "TASK_ATTACHMENT_ADDED"
  | "TASK_ATTACHMENT_REMOVED";

export interface ActivityUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string;
}

export interface ActivityTask {
  id: string;
  title: string;
  slug: string;
}

export interface ActivityRelatedData {
  type: string;
}

export interface TaskActivityType {
  id: string;
  type: ActivityType;
  description: string;
  entityType: string;
  entityId: string;
  oldValue: Task | string | number | null;
  newValue: Task | string | number | null;
  createdAt: string;
  user: ActivityUser;
  task: ActivityTask;
  relatedData: ActivityRelatedData;
}

export interface ActivityApiResponse {
  activities: TaskActivityType[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevious: boolean;
  };
}

export interface DynamicColumn {
  id: string;
  label: string;
  type:
    | "task-type"
    | "task-id"
    | "description"
    | "timeline"
    | "completed-date"
    | "story-points"
    | "original-estimate"
    | "remaining-estimate"
    | "reporter"
    | "created-by"
    | "updated-by"
    | "created-date"
    | "updated-date"
    | "sprint"
    | "parent-task"
    | "child-tasks"
    | "comments-count"
    | "attachments-count"
    | "time-entries";
  icon: React.ReactNode;
}
export interface CreateTaskCommentRequest {
  content: string;
  taskId: string;
  authorId: string;
  parentCommentId?: string;
}

export interface UpdateTaskCommentRequest {
  content: string;
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLabelRequest {
  name: string;
  color: string;
  description?: string;
  projectId: string;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: string;
  description?: string;
}

export interface AssignLabelRequest {
  taskId: string;
  labelId: string;
  userId: string;
}

export interface AssignMultipleLabelsRequest {
  taskId: string;
  labelIds: string[];
}
export enum TaskType {
  TASK = "TASK",
  BUG = "BUG",
  EPIC = "EPIC",
  STORY = "STORY",
  SUBTASK = "SUBTASK",
}

export enum StatusCategory {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
}

export enum DependencyType {
  BLOCKS = "BLOCKS",
  FINISH_START = "FINISH_START",
  START_START = "START_START",
  FINISH_FINISH = "FINISH_FINISH",
  START_FINISH = "START_FINISH",
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
  projectId: string;
}

export interface TaskDependency {
  id: string;
  type: DependencyType;
  dependentTaskId: string;
  blockingTaskId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  content: string;
  authorId: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    email: string;
  };
  taskId: string;
  createdAt: string;
  updatedAt: string;
  // Email integration fields
  emailMessageId?: string;
  sentAsEmail?: boolean;
  emailRecipients?: string[];
  emailSentAt?: string;
}

export interface TaskAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  taskId: string;
  uploadedById: string;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  description?: string;
  timeSpent: number; // in minutes
  date: string;
  taskId: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  projectId: string;
  assigneeIds?: string[];
  reporterIds?: string[];
  statusId: string;
  sprintId?: string;
  parentTaskId?: string;
  startDate?: string;
  dueDate?: string;
  storyPoints?: number;
  originalEstimate?: number;
  customFields?: Record<string, any>;
  labels?: string[];
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {}

export interface TaskFilter {
  search?: string;
  assigneeIds?: string[];
  reporterIds?: string[];
  statusIds?: string[];
  labelIds?: string[];
  priorities?: TaskPriority[];
  types?: TaskType[];
  sprintIds?: string[];
  dueDateFrom?: string;
  dueDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
  hasAttachments?: boolean;
  hasComments?: boolean;
}
export interface CreateAttachmentRequest {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  taskId: string;
}
export interface AttachmentStats {
  totalAttachments: number;
  totalSize: number;
  fileTypes: Record<string, number>;
}
