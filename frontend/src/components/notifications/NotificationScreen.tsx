import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HiBell,
  HiCheck,
  HiTrash,
  HiUser,
  HiCheckCircle,
  HiInformationCircle,
  HiClock,
  HiFolder,
  HiCog,
} from "react-icons/hi2";
import { notificationApi } from "@/utils/api/notificationApi";
import { PageHeader } from "@/components/common/PageHeader";
import ActionButton from "@/components/common/ActionButton";
import Pagination from "@/components/common/Pagination";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";
import { Notification, NotificationPriority, NotificationType } from "@/types";
import { toast } from "sonner";
import NotificationSkeleton from "../skeletons/NotificationSkeleton";
import { Clock3 } from "lucide-react";

interface NotificationScreenProps {
  userId: string;
  organizationId: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function NotificationScreen({ userId, organizationId }: NotificationScreenProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    byType: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
  });

  const getNotificationIcon = (type: NotificationType) => {
    const iconMap = {
      TASK_ASSIGNED: HiUser,
      TASK_STATUS_CHANGED: HiCheckCircle,
      TASK_COMMENTED: HiInformationCircle,
      TASK_DUE_SOON: HiClock,
      PROJECT_CREATED: HiFolder,
      PROJECT_UPDATED: HiFolder,
      WORKSPACE_INVITED: HiUser,
      MENTION: HiInformationCircle,
      SYSTEM: HiCog,
    };
    return iconMap[type] || HiInformationCircle;
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    const colorMap = {
      LOW: "text-green-600 bg-green-50 border-green-200",
      MEDIUM: "text-yellow-600 bg-yellow-50 border-yellow-200",
      HIGH: "text-orange-600 bg-orange-50 border-orange-200",
      URGENT: "text-red-600 bg-red-50 border-red-200",
    };
    return colorMap[priority] || "text-gray-600 bg-gray-50 border-gray-200";
  };

  const getTypeLabel = (type: NotificationType) => {
    const labelMap = {
      TASK_ASSIGNED: "Task Assigned",
      TASK_STATUS_CHANGED: "Task Status",
      TASK_COMMENTED: "Task Comment",
      TASK_DUE_SOON: "Due Soon",
      PROJECT_CREATED: "Project Created",
      PROJECT_UPDATED: "Project Updated",
      WORKSPACE_INVITED: "Workspace Invite",
      MENTION: "Mention",
      SYSTEM: "System",
    };
    return labelMap[type] || type.replace(/_/g, " ");
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await notificationApi.markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setStats((prev) => ({
          ...prev,
          unread: Math.max(0, prev.unread - 1),
        }));
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    }

    const { type, entityType, entityId, actionUrl } = notification;

    if (actionUrl) {
      router.push(actionUrl);
      return;
    }

    switch (type) {
      case "TASK_ASSIGNED":
      case "TASK_STATUS_CHANGED":
      case "TASK_COMMENTED":
      case "TASK_DUE_SOON":
        if (entityId) {
          router.push(`/tasks/${entityId}`);
        } else {
          router.push("/tasks");
        }
        break;

      case "PROJECT_CREATED":
      case "PROJECT_UPDATED":
        if (entityId) {
          router.push(`/projects/${entityId}`);
        } else {
          router.push("/projects");
        }
        break;

      case "WORKSPACE_INVITED":
        if (entityId) {
          router.push(`/workspaces/${entityId}`);
        } else {
          router.push("/workspaces");
        }
        break;

      case "MENTION":
        if (entityType === "task" && entityId) {
          router.push(`/tasks/${entityId}`);
        } else if (entityType === "project" && entityId) {
          router.push(`/projects/${entityId}`);
        } else {
          router.push("/dashboard");
        }
        break;

      case "SYSTEM":
        router.push("/settings/notifications");
        break;

      default:
        router.push("/dashboard");
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!userId || !organizationId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await notificationApi.getNotificationsByUserAndOrganization(
        userId,
        organizationId,
        {
          page: currentPage,
          limit: pageSize,
        }
      );

      setNotifications(response.notifications);
      setPagination(response.pagination);
      setStats(response.summary);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setError(error?.message || "Failed to load notifications. Please try again.");
      setNotifications([]);
      setPagination({
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } finally {
      setLoading(false);
    }
  }, [userId, organizationId, currentPage, pageSize]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationIds: string[]) => {
    try {
      if (notificationIds.length === 1) {
        await notificationApi.markNotificationAsRead(notificationIds[0]);
      } else {
        await Promise.all(notificationIds.map((id) => notificationApi.markNotificationAsRead(id)));
      }
      setNotifications((prev) =>
        prev.map((n) => (notificationIds.includes(n.id) ? { ...n, isRead: true } : n))
      );
      setSelectedNotifications(new Set());
      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - notificationIds.length),
      }));
      toast.success("Successfully marked as read");
    } catch (error) {
      toast.error(error?.message || "Failed to mark as read the notification(s)");
      console.error("Failed to mark notification(s) as read:", error);
    }
  };

  const handleBulkDelete = async (notificationIds: string[]) => {
    try {
      if (notificationIds.length === 1) {
        await notificationApi.deleteNotification(notificationIds[0]);
      } else {
        await notificationApi.deleteMultipleNotifications(notificationIds);
      }

      setNotifications((prev) => prev.filter((n) => !notificationIds.includes(n.id)));
      setSelectedNotifications(new Set());
      setStats((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - notificationIds.length),
      }));

      const remainingNotifications = notifications.filter((n) => !notificationIds.includes(n.id));

      if (remainingNotifications.length === 0 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        fetchNotifications();
      }
      toast.success("Notifications(s) deleted successfully!");
    } catch (error) {
      toast.error(error?.message || "Notifications(s) deleted successfully!");
      console.error("Failed to delete notification(s):", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllUnreadAsRead(organizationId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setStats((prev) => ({ ...prev, unread: 0 }));
      toast.success("Successfully marked all as read");
    } catch (error) {
      toast.error(error?.message || "Failed to mark all as read");
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchNotifications();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedNotifications(new Set());
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setSelectedNotifications(new Set());
  };

  const renderContent = () => {
    if (loading) {
      return <NotificationSkeleton />;
    }

    if (error) {
      return <ErrorState error={error} onRetry={handleRetry} />;
    }

    if (!notifications.length) {
      return <EmptyState searchQuery={""} priorityFilter={"all"} />;
    }

    return (
      <div className="divide-y divide-[var(--border)]">
        {notifications.map((notification) => {
          const isUnread = !notification.isRead;
          const isSelected = selectedNotifications.has(notification.id);

          return (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`
              flex flex-col gap-1 px-2 sm:px-4 py-4 cursor-pointer transition-all
              hover:bg-[var(--muted)]/30
              ${isSelected ? "bg-[var(--accent)]" : ""}
            `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <div onClick={(e) => e.stopPropagation()} className="mr-5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const newSelected = new Set(selectedNotifications);
                        if (e.target.checked) newSelected.add(notification.id);
                        else newSelected.delete(notification.id);
                        setSelectedNotifications(newSelected);
                      }}
                      className="accent-[var(--primary)] cursor-pointer"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h4
                        className={`font-bold text-[15px] truncate ${
                          isUnread ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {notification.title}
                      </h4>
                    </div>

                    <p
                      className={`text-sm mt-[2px] line-clamp-2 ${
                        isUnread ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      {notification.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                      <Badge
                        variant="outline"
                        className="border-[var(--border)] text-[var(--muted-foreground)]"
                      >
                        {getTypeLabel(notification.type)}
                      </Badge>

                      <Badge
                        variant="secondary"
                        className={`text-[var(--foreground)] bg-[var(--muted)]`}
                      >
                        {notification.priority}
                      </Badge>

                      {notification.createdByUser && (
                        <span>
                          by {notification.createdByUser.firstName}{" "}
                          {notification.createdByUser.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <div className="flex justify-center items-center gap-2">
                    <Clock3 className="w-3 h-3 opacity-80" />
                    <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  {!notification.isRead && (
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--primary)]"></span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dashboard-container h-[91vh] flex flex-col space-y-3">
      {/* Sticky PageHeader */}
      <div className="sticky top-0 z-10">
        <PageHeader
          icon={<HiBell className="size-20px" />}
          title="Notifications"
          description={`${stats.total} total notifications, ${stats.unread} unread`}
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
              {stats.unread > 0 && (
                <ActionButton primary onClick={handleMarkAllAsRead}>
                  Mark All Read ({stats.unread})
                </ActionButton>
              )}

              {/* Bulk Actions Bar */}
              {selectedNotifications.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    onClick={() => handleMarkAsRead(Array.from(selectedNotifications))}
                    className="bg-[var(--primary)] text-[var(--muted)]"
                  >
                    <HiCheck className="w-4 h-4" />
                    Mark as Read
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleBulkDelete(Array.from(selectedNotifications))}
                    className="bg-[var(--destructive)]"
                  >
                    <HiTrash className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto rounded-md py-4 scrollbar-none">{renderContent()}</div>

      {/* Sticky Pagination */}
      <div className="sticky bottom-0 z-30 pb-2">
        <Pagination
          pagination={pagination}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onPageChange={handlePageChange}
          itemType="notifications"
        />
      </div>
    </div>
  );
}
