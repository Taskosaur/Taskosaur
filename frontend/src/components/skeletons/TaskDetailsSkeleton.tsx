import React from "react";
import { Skeleton } from "../ui/skeleton";

const TaskDetailsSkeleton = () => {
  return (
    <div className="dashboard-container animate-in fade-in duration-200">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-48 rounded-md" />
            </div>
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>

          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 p-0 justify-between">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
              <Skeleton className="h-4 w-4/6 rounded-md" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-5 w-32 rounded-md" />
              <div className="flex gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-20 rounded-md" />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Skeleton className="h-5 w-24 rounded-md" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 w-48 rounded-md" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-28 rounded-md" />
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-3/4 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6 max-w-[18vw] w-full">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-32 rounded-md mb-2" />
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>
              ))}
            </div>

            <Skeleton className="h-4 w-28 rounded-md" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 rounded-md mb-2" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              ))}
            </div>

            <Skeleton className="h-4 w-24 rounded-md" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-14 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-28 rounded-md" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-32 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsSkeleton;
