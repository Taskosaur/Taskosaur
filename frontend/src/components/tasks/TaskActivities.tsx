import React, { useEffect, useState } from "react";
import { HiOutlineBolt } from "react-icons/hi2";
import { useTask } from "@/contexts/task-context";
import { TaskActivityType } from "@/types/tasks";
import { useAuth } from "@/contexts/auth-context";

interface TaskActivitiesProps {
  taskId: string;
  setLoading?: (loading: boolean) => void;
}

const TaskActivities: React.FC<TaskActivitiesProps> = ({ taskId, setLoading }) => {
  const { getTaskActivity } = useTask();
  const { isAuthenticated } = useAuth();
  const [activities, setActivities] = useState<TaskActivityType[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const isAuth = isAuthenticated();
  const INITIAL_DISPLAY_COUNT = 3;

  useEffect(() => {
    fetchActivities(1);
  }, [taskId]);

  useEffect(() => {
    if (setLoading) {
      setLoading(loadingActivities);
    }
  }, [loadingActivities]);

  const fetchActivities = async (pageNum: number, append = false) => {
    setLoadingActivities(true);
    try {
      const response = await getTaskActivity(taskId, isAuth, pageNum);

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
      setLoadingActivities(false);
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
      return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`;
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

  const displayedActivities = showAll ? activities : activities.slice(0, INITIAL_DISPLAY_COUNT);

  const hasMoreToShow = activities.length > INITIAL_DISPLAY_COUNT;
  const canLoadMorePages = page < totalPages;

  if (loadingActivities && activities.length === 0) {
    return (
      <div className="w-full rounded-xl p-4 flex flex-col bg-[var(--card)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1 rounded-md">
            <HiOutlineBolt className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Activities</h3>
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
        {/* <div className="flex items-center gap-2 mb-4">
          <div className="p-1 rounded-md">
            <HiOutlineBolt className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Activities
          </h3>
        </div> */}
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl flex flex-col">
      {/* <div className="flex items-center gap-2 mb-4">
        <div className="p-1 rounded-md">
          <HiOutlineBolt className="w-4 h-4 text-[var(--primary)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          Activities
        </h3>
      </div> */}

      {activities.length === 0 ? (
        <div className="flex items-center justify-between border-none">
          {/* Left side: icon + text in one line */}
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-sm">
            <HiOutlineBolt className="size-4" />
            <h4 className="font-medium text-[var(--muted-foreground)] text-sm tracking-wide">
              No activities yet
            </h4>
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {/* Activities List with Timeline */}
          <div className="activity-timeline-container ">
            {displayedActivities.map((activity, index) => (
              <div key={activity.id} className="activity-timeline-item ">
                {/* Timeline Connector */}
                <div className="activity-timeline">
                  {/* Top Line */}
                  {index !== 0 && <div className="timeline-line-top" />}

                  {/* Bullet Point */}
                  <div className="timeline-bullet">
                    <div className="timeline-bullet-inner" />
                  </div>

                  {/* Bottom Line */}
                  {index !== displayedActivities.length - 1 && (
                    <div className="timeline-line-bottom" />
                  )}
                </div>

                {/* Content */}
                <div className="activity-content">
                  <div className="text-sm text-[var(--foreground)] font-medium">
                    {generateSimpleMessage(activity)}
                  </div>
                  <div className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                    {formatTimestamp(activity.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* View More / Show Less Buttons */}
          {(hasMoreToShow || canLoadMorePages) && (
            <div className="flex justify-center pt-4">
              {!showAll && hasMoreToShow && (
                <button
                  className="text-xs text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer transition-colors"
                  onClick={toggleShowAll}
                >
                  View more ({activities.length - INITIAL_DISPLAY_COUNT} more)
                </button>
              )}

              {showAll && hasMoreToShow && (
                <button
                  className="text-xs text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer transition-colors"
                  onClick={toggleShowAll}
                >
                  Show less
                </button>
              )}

              {showAll && canLoadMorePages && (
                <button
                  className="text-xs text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-2"
                  onClick={loadMore}
                  disabled={loadingActivities}
                >
                  {loadingActivities ? "Loading..." : "Load more activities"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskActivities;
