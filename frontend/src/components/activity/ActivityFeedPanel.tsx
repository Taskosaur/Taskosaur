import Link from "next/link";
import { HiClock, HiChatBubbleLeft } from "react-icons/hi2";
import { InfoPanel } from "@/components/common/InfoPanel";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface ActivityFeedItem {
  id: string;
  user: {
    name?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    id?: string;
  };
  action?: string;
  description: string;
  type: string;
  entityType?: string;
  entityId?: string;
  createdAt: string | Date;
  metadata?: { comment?: string } & Record<string, unknown>;
  newValue?: {
    title?: string;
    taskId?: string;
    task?: {
      id?: string;
      [key: string]: unknown;
    };
    user?: {
      id?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      [key: string]: unknown;
    };
    member?: {
      user?: {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    entity?: {
      id?: string;
      name?: string;
      slug?: string;
      type?: string;
      [key: string]: unknown;
    };
  } & Record<string, unknown>;
}

interface ActivityFeedPanelProps {
  title: string;
  subtitle?: string;
  activities: any[];
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClearFilter?: () => void;
  emptyMessage?: string;
}

function getEntityLink(activity: ActivityFeedItem): string {
  if (!activity.entityType) return "#";

  const entityType = activity.entityType.toLowerCase();

  // For task attachments, get the task ID from newValue
  if (entityType === "task attachment" || entityType === "task attchment") {
    const taskId = activity.newValue?.taskId || activity.newValue?.task?.id;
    if (taskId) {
      return `/tasks/${taskId}`;
    }
  }

  if (!activity.entityId) return "#";

  switch (entityType) {
    case "task":
      return `/tasks/${activity.entityId}`;
    case "project":
      return `/projects/${activity.entityId}`;
    case "workspace":
      return `/workspaces/${activity.entityId}`;
    case "user":
      return `/users/${activity.entityId}`;
    default:
      return "#";
  }
}

function normalizeActivity(activity: any): ActivityFeedItem {
  const user = activity.user || {};

  const userName =
    user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User";

  const description = activity.description || activity.newValue?.title || "Activity";

  return {
    id: activity.id || "",
    type: (activity.type || "").toLowerCase(),
    description,
    entityType: activity.entityType || null,
    entityId: activity.entityId || null,
    createdAt: activity.createdAt || "",
    user: {
      name: userName,
      avatar: user.avatar || null,
      id: user.id || null,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    action: activity.description || description,
    metadata: activity.metadata || {},
    newValue: activity.newValue || {},
  };
}

export function ActivityFeedPanel({
  title,
  subtitle,
  activities,
  isLoading,
  error,
  onRetry,
  onClearFilter,
  emptyMessage = "No activity yet",
}: ActivityFeedPanelProps) {
  const normalizedActivities = activities.map(normalizeActivity);

  if (isLoading) {
    return (
      <InfoPanel title={title} subtitle={subtitle}>
        <div className="activity-loading-container">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="activity-loading-item">
              <div className="activity-loading-avatar" />
              <div className="activity-loading-content">
                <div className="activity-loading-title" />
                <div className="activity-loading-subtitle" />
              </div>
            </div>
          ))}
        </div>
      </InfoPanel>
    );
  }

  if (normalizedActivities.length === 0) {
    return (
      <InfoPanel title={title} subtitle={subtitle}>
        <div className="activity-empty-container">
          <div className="activity-empty-icon-container">
            <HiClock className="activity-empty-icon" />
          </div>
          <p className="activity-empty-title">{emptyMessage}</p>
          <p className="activity-empty-description">
            Recent activity will appear here once things start moving.
          </p>
          {onClearFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilter}
              className="activity-empty-button"
            >
              Show All Activities
            </Button>
          )}
        </div>
      </InfoPanel>
    );
  }

  return (
    <InfoPanel title={title} subtitle={subtitle}>
      <div className="activity-feed-container">
        {normalizedActivities.map((activity) => (
          <div key={activity.id} className="activity-feed-item">
            <Avatar className="activity-feed-avatar">
              <AvatarFallback className="activity-feed-avatar-fallback">
                {activity?.user?.name
                  ?.split(" ")
                  .map((n) => n.charAt(0))
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Details */}
            <div className="activity-content-container">
              <div className="activity-content-main">
                <span className="activity-content-user-name">
                  {activity?.user?.name ? activity.user.name : "Unknown User"}
                </span>
                <span className="activity-content-action">
                  {activity.type === "invitation_sent" ? (
                    <>
                      Sent invitation to{" "}
                      <span className="activity-content-user-name">
                        {activity.newValue?.user?.firstName && activity.newValue?.user?.lastName
                          ? `${activity.newValue.user.firstName} ${activity.newValue.user.lastName}`
                          : activity.newValue?.member?.user?.firstName &&
                              activity.newValue?.member?.user?.lastName
                            ? `${activity.newValue.member.user.firstName} ${activity.newValue.member.user.lastName}`
                            : activity.newValue?.user?.email ||
                              activity.newValue?.member?.user?.email ||
                              "Unknown User"}
                      </span>{" "}
                      to join {activity.newValue?.entity?.type || "organization/workspace/project"}
                    </>
                  ) : (
                    activity.action
                  )}
                </span>
                {activity.entityId && activity.type !== "invitation_sent" && (
                  <span>
                    <Link href={getEntityLink(activity)} className="activity-content-link">
                      View {activity.entityType?.replace(/\s*Att[a]?chment$/i, "")}
                    </Link>
                  </span>
                )}
              </div>

              {/* Meta row */}
              <div className="activity-meta-row">
                <div className="activity-meta-timestamp">
                  <HiClock className="activity-meta-timestamp-icon" />
                  <span className="activity-meta-timestamp-text">
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Optional comment bubble */}
              {activity.metadata?.comment && (
                <div className="activity-comment-container">
                  <div className="activity-comment-content">
                    <HiChatBubbleLeft className="activity-comment-icon" />
                    <p className="activity-comment-text">{activity.metadata.comment}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </InfoPanel>
  );
}
