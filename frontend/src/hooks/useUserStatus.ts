import { useState, useEffect, useCallback } from "react";
import { userApi } from "@/utils/api/userApi";
import { UserStatus, BulkUserStatus } from "@/types";

/**
 * Hook to get online status for a single user
 */
export const useUserStatus = (userId: string | null) => {
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await userApi.getUserStatus(userId);
      setStatus(data);
    } catch (err) {
      console.error(`[useUserStatus] Failed to fetch status for user ${userId}:`, err);
      setError(err instanceof Error ? err : new Error("Failed to fetch user status"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Listen for real-time status updates via custom event
  useEffect(() => {
    if (!userId) return;

    const handleUserOnline = (event: CustomEvent) => {
      if (event.detail.userId === userId) {
        setStatus((prev) => (prev ? { ...prev, ...event.detail } : event.detail));
      }
    };

    const handleUserOffline = (event: CustomEvent) => {
      if (event.detail.userId === userId) {
        setStatus((prev) => (prev ? { ...prev, ...event.detail } : event.detail));
      }
    };

    // Listen for WebSocket events (you'll need to set this up in your socket connection)
    window.addEventListener("user:online", handleUserOnline as EventListener);
    window.addEventListener("user:offline", handleUserOffline as EventListener);

    return () => {
      window.removeEventListener("user:online", handleUserOnline as EventListener);
      window.removeEventListener("user:offline", handleUserOffline as EventListener);
    };
  }, [userId]);

  return {
    status,
    isOnline: status?.isOnline ?? false,
    lastSeen: status?.lastSeen,
    loading,
    error,
    refresh: fetchStatus,
  };
};

/**
 * Hook to get online status for multiple users
 */
export const useUsersStatus = (userIds: string[]) => {
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatuses = useCallback(async () => {
    if (userIds.length === 0) {
      setStatuses({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await userApi.getUsersStatus(userIds);
      const statusMap: Record<string, UserStatus> = {};

      Object.entries(data.status).forEach(([userId, status]) => {
        statusMap[userId] = {
          userId,
          ...status,
        };
      });

      setStatuses(statusMap);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch users status"));
    } finally {
      setLoading(false);
    }
  }, [userIds]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Listen for real-time status updates
  useEffect(() => {
    const handleUserOnline = (event: CustomEvent) => {
      const userId = event.detail.userId;
      if (userIds.includes(userId)) {
        setStatuses((prev) => ({
          ...prev,
          [userId]: {
            userId,
            isOnline: event.detail.isOnline,
            lastSeen: event.detail.lastSeen,
          },
        }));
      }
    };

    const handleUserOffline = (event: CustomEvent) => {
      const userId = event.detail.userId;
      if (userIds.includes(userId)) {
        setStatuses((prev) => ({
          ...prev,
          [userId]: {
            userId,
            isOnline: event.detail.isOnline,
            lastSeen: event.detail.lastSeen,
          },
        }));
      }
    };

    window.addEventListener("user:online", handleUserOnline as EventListener);
    window.addEventListener("user:offline", handleUserOffline as EventListener);

    return () => {
      window.removeEventListener("user:online", handleUserOnline as EventListener);
      window.removeEventListener("user:offline", handleUserOffline as EventListener);
    };
  }, [userIds]);

  const getStatus = (userId: string) => statuses[userId] || null;
  const isOnline = (userId: string) => statuses[userId]?.isOnline ?? false;
  const getLastSeen = (userId: string) => statuses[userId]?.lastSeen;

  return {
    statuses,
    getStatus,
    isOnline,
    getLastSeen,
    loading,
    error,
    refresh: fetchStatuses,
  };
};

/**
 * Utility function to format last seen time
 */
export const formatLastSeen = (lastSeen?: string | null): string => {
  if (!lastSeen) return "Last seen unknown";

  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};
