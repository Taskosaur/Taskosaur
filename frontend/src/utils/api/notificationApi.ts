import api from "@/lib/api";
import {
  Notification,
  NotificationFilters,
  NotificationPriority,
  NotificationResponse,
  NotificationStats,
  NotificationType,
  RecentNotificationsResponse,
} from "@/types";

export const notificationApi = {
  // Get user notifications with filters and pagination
  getUserNotifications: async (
    filters: NotificationFilters = {}
  ): Promise<NotificationResponse> => {
    try {
      const params = new URLSearchParams();

      // Add filters as query parameters
      if (filters.limit !== undefined) {
        params.append("limit", Math.min(Math.max(1, filters.limit), 100).toString());
      }

      if (filters.page !== undefined) {
        params.append("page", Math.max(1, filters.page).toString());
      }

      if (filters.isRead !== undefined) {
        params.append("isRead", filters.isRead.toString());
      }

      if (filters.type) {
        params.append("type", filters.type);
      }

      if (filters.organizationId) {
        params.append("organizationId", filters.organizationId);
      }

      const response = await api.get<NotificationResponse>(`/notifications?${params.toString()}`);

      return response.data;
    } catch (error) {
      console.error("Failed to fetch user notifications:", error);
      throw error;
    }
  },

  // Get unread notification count
  getUnreadNotificationCount: async (organizationId?: string): Promise<{ count: number }> => {
    try {
      const params = new URLSearchParams();
      if (organizationId) {
        params.append("organizationId", organizationId);
      }

      const response = await api.get<{ count: number }>(
        `/notifications/unread-count?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
      throw error;
    }
  },

  // Get recent notifications (last 7 days)
  getRecentNotifications: async (
    filters: {
      limit?: number;
      organizationId?: string;
    } = {}
  ): Promise<RecentNotificationsResponse> => {
    try {
      const params = new URLSearchParams();

      if (filters.limit !== undefined) {
        params.append("limit", Math.min(Math.max(1, filters.limit), 50).toString());
      }

      if (filters.organizationId) {
        params.append("organizationId", filters.organizationId);
      }

      const response = await api.get<RecentNotificationsResponse>(
        `/notifications/recent?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to fetch recent notifications:", error);
      throw error;
    }
  },

  // Get notifications by specific type
  getNotificationsByType: async (
    type: NotificationType,
    filters: {
      page?: number;
      limit?: number;
      organizationId?: string;
    } = {}
  ): Promise<NotificationResponse> => {
    try {
      const params = new URLSearchParams();

      if (filters.page !== undefined) {
        params.append("page", Math.max(1, filters.page).toString());
      }

      if (filters.limit !== undefined) {
        params.append("limit", Math.min(Math.max(1, filters.limit), 100).toString());
      }

      if (filters.organizationId) {
        params.append("organizationId", filters.organizationId);
      }

      const response = await api.get<NotificationResponse>(
        `/notifications/by-type/${type}?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to fetch notifications by type:", error);
      throw error;
    }
  },

  // Get notification by ID
  getNotificationById: async (notificationId: string): Promise<Notification> => {
    try {
      // Validate notificationId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(notificationId)) {
        throw new Error(`Invalid notificationId format: ${notificationId}. Expected UUID format.`);
      }

      const response = await api.get<Notification>(`/notifications/${notificationId}`);

      return response.data;
    } catch (error) {
      console.error("Failed to fetch notification by ID:", error);
      throw error;
    }
  },

  // Mark notification as read
  markNotificationAsRead: async (notificationId: string): Promise<{ message: string }> => {
    try {
      // Validate notificationId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(notificationId)) {
        throw new Error(`Invalid notificationId format: ${notificationId}. Expected UUID format.`);
      }

      const response = await api.patch<{ message: string }>(
        `/notifications/${notificationId}/read`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllNotificationsAsRead: async (organizationId?: string): Promise<{ message: string }> => {
    try {
      const params = new URLSearchParams();
      if (organizationId) {
        params.append("organizationId", organizationId);
      }

      const response = await api.patch<{ message: string }>(
        `/notifications/mark-all-read?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  },

  // Mark all unread notifications as read
  markAllUnreadAsRead: async (organizationId?: string): Promise<{ message: string }> => {
    try {
      const params = new URLSearchParams();
      if (organizationId) {
        params.append("organizationId", organizationId);
      }

      const response = await api.patch<{ message: string }>(
        `/notifications/mark-all-unread-read?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to mark all unread notifications as read:", error);
      throw error;
    }
  },

  // Delete notification
  deleteNotification: async (notificationId: string): Promise<void> => {
    try {
      // Validate notificationId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(notificationId)) {
        throw new Error(`Invalid notificationId format: ${notificationId}. Expected UUID format.`);
      }

      await api.delete(`/notifications/${notificationId}`);
    } catch (error) {
      console.error("Failed to delete notification:", error);
      throw error;
    }
  },

  // Delete multiple notifications
  deleteMultipleNotifications: async (notificationIds: string[]): Promise<void> => {
    try {
      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        throw new Error("notificationIds must be a non-empty array");
      }

      // Validate all notification IDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      for (const id of notificationIds) {
        if (!uuidRegex.test(id)) {
          throw new Error(`Invalid notificationId format: ${id}. Expected UUID format.`);
        }
      }

      await api.delete("/notifications/bulk", {
        data: { notificationIds },
      });
    } catch (error) {
      console.error("Failed to delete multiple notifications:", error);
      throw error;
    }
  },

  // Get notification statistics
  getNotificationStats: async (organizationId?: string): Promise<NotificationStats> => {
    try {
      const params = new URLSearchParams();
      if (organizationId) {
        params.append("organizationId", organizationId);
      }

      const response = await api.get<NotificationStats>(
        `/notifications/stats/summary?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to fetch notification stats:", error);
      throw error;
    }
  },

  // Helper function to get unread notifications only
  getUnreadNotifications: async (
    filters: Omit<NotificationFilters, "isRead"> = {}
  ): Promise<NotificationResponse> => {
    try {
      return await notificationApi.getUserNotifications({
        ...filters,
        isRead: false,
      });
    } catch (error) {
      console.error("Failed to fetch unread notifications:", error);
      throw error;
    }
  },

  // Helper function to get read notifications only
  getReadNotifications: async (
    filters: Omit<NotificationFilters, "isRead"> = {}
  ): Promise<NotificationResponse> => {
    try {
      return await notificationApi.getUserNotifications({
        ...filters,
        isRead: true,
      });
    } catch (error) {
      console.error("Failed to fetch read notifications:", error);
      throw error;
    }
  },

  // Helper function to get task-related notifications
  getTaskNotifications: async (
    filters: Omit<NotificationFilters, "type"> = {}
  ): Promise<NotificationResponse[]> => {
    try {
      const taskNotificationTypes: NotificationType[] = [
        "TASK_ASSIGNED",
        "TASK_STATUS_CHANGED",
        "TASK_COMMENTED",
        "TASK_DUE_SOON",
      ];

      const promises = taskNotificationTypes.map((type) =>
        notificationApi.getNotificationsByType(type, filters)
      );

      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      console.error("Failed to fetch task notifications:", error);
      throw error;
    }
  },

  // Helper function to clear all notifications (mark as read and optionally delete)
  clearAllNotifications: async (
    organizationId?: string,
    deleteAfterRead: boolean = false
  ): Promise<{ message: string }> => {
    try {
      // First mark all as read
      await notificationApi.markAllNotificationsAsRead(organizationId);

      if (deleteAfterRead) {
        // Get all notifications and delete them
        const notifications = await notificationApi.getUserNotifications({
          organizationId,
          limit: 100, // Get a large batch
        });

        if (notifications.notifications.length > 0) {
          const notificationIds = notifications.notifications.map((n) => n.id);
          await notificationApi.deleteMultipleNotifications(notificationIds);
        }
      }

      return { message: "All notifications cleared successfully" };
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
      throw error;
    }
  },

  // Helper function to refresh notification count (useful for real-time updates)
  refreshNotificationData: async (organizationId?: string) => {
    try {
      const [unreadCount, recentNotifications, stats] = await Promise.all([
        notificationApi.getUnreadNotificationCount(organizationId),
        notificationApi.getRecentNotifications({ limit: 5, organizationId }),
        notificationApi.getNotificationStats(organizationId),
      ]);

      const refreshedData = {
        unreadCount: unreadCount.count,
        recentNotifications: recentNotifications.notifications,
        stats,
      };

      return refreshedData;
    } catch (error) {
      console.error("Failed to refresh notification data:", error);
      throw error;
    }
  },
  // Add this to your notificationApi object
  getNotificationsByUserAndOrganization: async (
    userId: string,
    organizationId: string,
    filters: {
      isRead?: boolean;
      type?: NotificationType;
      priority?: NotificationPriority;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    notifications: Notification[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    summary: {
      total: number;
      unread: number;
      byType: Record<string, number>;
      byPriority: Record<string, number>;
    };
  }> => {
    try {
      // Validate UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(userId)) {
        throw new Error(`Invalid userId format: ${userId}. Expected UUID format.`);
      }

      if (!uuidRegex.test(organizationId)) {
        throw new Error(`Invalid organizationId format: ${organizationId}. Expected UUID format.`);
      }

      const params = new URLSearchParams();

      // Add filters as query parameters
      if (filters.isRead !== undefined) {
        params.append("isRead", filters.isRead.toString());
      }

      if (filters.type) {
        params.append("type", filters.type);
      }

      if (filters.priority) {
        params.append("priority", filters.priority);
      }

      if (filters.startDate) {
        params.append("startDate", filters.startDate);
      }

      if (filters.endDate) {
        params.append("endDate", filters.endDate);
      }

      if (filters.page !== undefined) {
        params.append("page", Math.max(1, filters.page).toString());
      }

      if (filters.limit !== undefined) {
        params.append("limit", Math.min(Math.max(1, filters.limit), 100).toString());
      }
      const response = await api.get(
        `/notifications/user/${userId}/organization/${organizationId}?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Failed to fetch user-organization notifications:", error);
      throw error;
    }
  },
};
