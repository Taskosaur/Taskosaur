export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_COMMENTED"
  | "TASK_DUE_SOON"
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "WORKSPACE_INVITED"
  | "MENTION"
  | "SYSTEM";

export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  userId: string;
  organizationId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  createdByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
  organizationId?: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary?: {
    total: number;
    unread: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  recent: number;
  byType: Record<string, number>;
}

export interface RecentNotificationsResponse {
  notifications: Notification[];
  count: number;
}
