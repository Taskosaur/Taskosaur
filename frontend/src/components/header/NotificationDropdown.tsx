import { useState, useEffect } from "react";
import { useNotification } from "@/contexts/notification-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { HiBell } from "react-icons/hi2";
import { notificationApi } from "@/utils/api/notificationApi";
import Tooltip from "../common/ToolTip";
import { useRouter } from "next/router";
import ActionButton from "../common/ActionButton";

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isRead: boolean;
  createdAt: string;
  createdByUser?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  entity?: any;
}

interface NotificationDropdownProps {
  userId?: string;
  organizationId?: string;
  className?: string;
}

export default function NotificationDropdown({
  userId,
  organizationId,
  className = "",
}: NotificationDropdownProps) {
  // Use context for Unread Count to keep it in sync globally
  const { unreadCount: globalUnreadCount, refreshNotifications } = useNotification();
  
  // Local state for the dropdown list items
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // We ignore local unreadCount in favor of global one for the badge
  const [loading, setLoading] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // When dropdown opens, fetch the list AND refresh global count
    const fetchNotifications = async () => {
      if (!dropdownOpen || !userId || !organizationId) return;
      
      // trigger global refresh
      refreshNotifications();

      try {
        setLoading(true);
        // We fetch explicitly for the dropdown list
        const response = await notificationApi.getNotificationsByUserAndOrganization(
          userId,
          organizationId,
          {
            isRead: false,
            page: 1,
            limit: 5,
          }
        );

        setNotifications(response.notifications);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [userId, organizationId, dropdownOpen, refreshNotifications]);

  const formatNotificationTime = (dateString: string) => {
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

  const getNotificationUserInitials = (user?: Notification["createdByUser"]) => {
    if (!user?.firstName && !user?.lastName) return "S";
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getPriorityColor = (priority: Notification["priority"]) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  /* Update handleMarkAsRead to use API and refresh context */
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setMarkingAsRead(notificationId);
      await notificationApi.markNotificationAsRead(notificationId);
      
      // Update local list
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      
      // Refresh global count
      refreshNotifications();

    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    } finally {
      setMarkingAsRead(null);
    }
  };

  const handleViewAllNotifications = () => {
    setDropdownOpen(false);
    setTimeout(() => {
      router.push("/notifications");
    }, 100);
  };

  if (!userId || !organizationId) return null;

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <Tooltip content="Notifications" position="bottom" color="primary">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`header-notification-button relative w-10 h-10 rounded-full hover:bg-[var(--accent)] ${className}`}
            aria-label="Notifications"
          >
            <div className="relative">
              <HiBell className="w-6 h-6 text-[var(--muted-foreground)]" />
              {globalUnreadCount > 0 && (
              <Badge
                variant="destructive"
                className="header-notification-badge  header-notification-badge-red"
              >
                {globalUnreadCount > 99 ? "99+" : (globalUnreadCount ?? 0)}
              </Badge>
            )}
            </div>
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent className="header-dropdown-menu-content" align="end" sideOffset={4}>
        {/* Header */}
        <div className="header-dropdown-menu-header">
          <div className="header-dropdown-menu-title">
            <span className="header-dropdown-menu-title-text">Notifications</span>
            <Badge variant="secondary" className="header-dropdown-menu-badge">
              {globalUnreadCount}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="header-dropdown-menu-body">
          {loading ? (
            <div className="header-loading-container">
              <div className="header-loading-list">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="header-loading-item">
                    <div className="header-loading-item-layout">
                      <div className="header-loading-avatar"></div>
                      <div className="header-loading-content">
                        <div className="header-loading-text-primary"></div>
                        <div className="header-loading-text-secondary"></div>
                        <div className="header-loading-text-tertiary"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="header-empty-state">
              <HiBell className="header-empty-icon" />
              <p className="header-empty-text">No new notifications</p>
            </div>
          ) : (
            <div className="header-notifications-item-container">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`header-notifications-item ${
                    markingAsRead === notification.id ? "header-notifications-item-disabled" : ""
                  }`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="header-notifications-item-layout">
                    <div className="header-notifications-item-avatar">
                      <span className="header-notifications-item-avatar-text">
                        {getNotificationUserInitials(notification.createdByUser)}
                      </span>
                    </div>

                    <div className="header-notifications-item-content">
                      <div className="header-notifications-item-header">
                        <div className="header-notifications-item-title">
                          {/* ✅ Show entity name if available, else title */}
                          {notification.entity?.name
                            ? `${notification.title}: ${notification.entity.name}`
                            : notification.title}
                        </div>

                        {(notification.priority === "HIGH" ||
                          notification.priority === "URGENT") && (
                          <div
                            className={`header-notifications-item-priority ${getPriorityColor(
                              notification.priority
                            )}`}
                          ></div>
                        )}
                      </div>

                      <div className="header-notifications-item-message">
                        {/* ✅ Optionally include entity name in message too */}
                        {notification.entity?.name
                          ? `${notification.message} (${notification.entity.name})`
                          : notification.message}
                      </div>

                      <div className="header-notifications-item-time">
                        {formatNotificationTime(notification.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {router.pathname !== "/notifications" && (
          <div className="header-notifications-footer">
            <ActionButton
              variant="ghost"
              onClick={handleViewAllNotifications}
              className="header-notifications-view-all"
            >
              {notifications.length > 0 ? "View All" : "View Old Notifications"}
            </ActionButton>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
