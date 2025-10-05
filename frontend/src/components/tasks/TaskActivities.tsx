import React, { useEffect, useState } from "react";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { HiOutlineBolt } from "react-icons/hi2";
import { useTask } from "@/contexts/task-context";
import { TaskActivityType } from "@/types/tasks";

interface TaskActivitiesProps {
  taskId: string;
}

function TaskActivities({ taskId }: TaskActivitiesProps) {
  const { getTaskActivity } = useTask();
  const [activities, setActivities] = useState<TaskActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const INITIAL_DISPLAY_COUNT = 3;

  useEffect(() => {
    fetchActivities(1);
  }, [taskId]);

  const fetchActivities = async (pageNum: number, append = false) => {
    try {
      setLoading(true);
      const response = await getTaskActivity(taskId, pageNum);

      if (response && response.activities) {
        if (append) {
          setActivities((prev) => [...prev, ...response.activities]);
        } else {
          setActivities(response.activities);
        }
        setHasMore(response.pagination.hasNextPage);
        setTotalPages(response.pagination.totalPages);
        setPage(pageNum);
      } else {
        setError("Failed to fetch activities");
      }
    } catch (err) {
      setError("An error occurred while fetching activities");
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (page < totalPages) {
      fetchActivities(page + 1, true);
      setShowAll(true);
    }
  };

  const toggleShowAll = () => {
    setShowAll(!showAll);
  };

  const generateSimpleMessage = (activity: TaskActivityType): string => {
    const name = activity.user.firstName;

    switch (activity.type) {
      case "TASK_CREATED":
        return `${name} added the task`;

      case "TASK_UPDATED":
        return `${name} updated the task`;

      case "TASK_COMMENTED":
        return `${name} commented`;

      case "TASK_DELETED":
        return `${name} deleted the task`;

      case "TASK_ASSIGNED":
        return `${name} changed assignee`;

      case "TASK_LABEL_ADDED":
        return `${name} label added`;

      case "TASK_LABEL_REMOVED":
        return `${name} label removed`;

      case "TASK_STATUS_CHANGED":
        return `${name} changed status`;

      case "TASK_ATTACHMENT_ADDED":
        return `${name} added task attachment`;

      case "TASK_ATTACHMENT_REMOVED":
        return `${name} removed task attachment`;

      default:
        return `${name} updated the task`;
    }
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInMonths = Math.floor(diffInDays / 30);

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} ${
        diffInMinutes === 1 ? "minute" : "minutes"
      } ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;
    } else if (diffInDays < 30) {
      return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`;
    } else if (diffInMonths < 12) {
      return `${diffInMonths} ${diffInMonths === 1 ? "month" : "months"} ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  // Determine which activities to display
  const displayedActivities = showAll
    ? activities
    : activities.slice(0, INITIAL_DISPLAY_COUNT);

  const hasMoreToShow = activities.length > INITIAL_DISPLAY_COUNT;
  const canLoadMorePages = page < totalPages;

  if (loading && activities.length === 0) {
    return (
      <div className="w-full rounded-xl p-4 flex flex-col bg-[var(--card)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1 rounded-md">
            <HiOutlineBolt className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Activities
          </h3>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-6 h-6 bg-[var(--muted)] rounded-full flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--muted)] rounded w-3/4"></div>
                <div className="h-3 bg-[var(--muted)] rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && activities.length === 0) {
    return (
      <div className="w-full rounded-xl flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1 rounded-md">
            <HiOutlineBolt className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Activities
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1 rounded-md">
          <HiOutlineBolt className="w-4 h-4 text-[var(--primary)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Activities
        </h3>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-6 bg-[var(--muted)]/10 rounded-lg border border-dashed border-[var(--border)]">
          <div className="p-2 rounded-full w-fit mx-auto mb-2">
            <HiOutlineBolt className="w-5 h-5 text-[var(--muted-foreground)]" />
          </div>
          <h4 className="text-[15px] font-medium text-[var(--foreground)] mb-1">
            No activities yet
          </h4>
          <p className="text-[13px] text-[var(--muted-foreground)]">
            All activity on this task will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Activities List */}
          <div className="space-y-3">
            {displayedActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 group hover:bg-[var(--accent)]/30 rounded-lg p-2 -mx-2 transition-colors"
              >
                <UserAvatar
                  user={{
                    firstName: activity.user.firstName,
                    lastName: activity.user.lastName,
                    avatar: activity.user.avatar,
                  }}
                  size="xs"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-[var(--foreground)] leading-relaxed">
                    {generateSimpleMessage(activity)}
                  </div>
                  <div className="text-[13px] text-[var(--muted-foreground)] mt-1">
                    {formatTimestamp(activity.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* View More / Show Less Buttons */}
          {(hasMoreToShow || canLoadMorePages) && (
            <div className="flex justify-center pt-2">
              {!showAll && hasMoreToShow && (
                <button
                  className="text-sm text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer transition-colors"
                  onClick={toggleShowAll}
                >
                  View more ({activities.length - INITIAL_DISPLAY_COUNT} more)
                </button>
              )}

              {showAll && hasMoreToShow && (
                <button
                  className="text-sm text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer transition-colors"
                  onClick={toggleShowAll}
                >
                  Show less
                </button>
              )}

              {showAll && canLoadMorePages && (
                <button
                  className="text-sm text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-2"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load more activities"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskActivities;
