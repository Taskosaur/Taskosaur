import React from "react";

interface NotificationSkeletonProps {
  count?: number;
}

const NotificationSkeleton: React.FC<NotificationSkeletonProps> = ({ count = 5 }) => {
  return (
    <div className="space-y-2 divide-y divide-[var(--border)]">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex flex-col gap-1 px-2 sm:px-4 py-4 animate-pulse">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-4 h-4 rounded bg-[var(--border)] mt-1" />

              <div className="w-8 h-8 rounded-md bg-[var(--border)]" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="h-4 bg-[var(--border)] rounded w-3/5" />
                <div className="h-3 bg-[var(--border)] rounded w-4/5 mt-1" />
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-3 bg-[var(--border)] rounded w-12" />
                  <div className="h-3 bg-[var(--border)] rounded w-16" />
                  <div className="h-3 bg-[var(--border)] rounded w-20" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <div className="h-3 w-10 bg-[var(--border)] rounded" />
              <div className="w-2 h-2 rounded-full bg-[var(--border)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationSkeleton;
