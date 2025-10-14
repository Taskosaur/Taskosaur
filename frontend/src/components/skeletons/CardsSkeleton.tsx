import React from "react";
import { PageHeaderSkeleton } from "../common/PageHeaderSkeleton";
import { Card } from "../ui";

interface CardsSkeletonProps {
  count?: number;
}

export const CardsSkeleton: React.FC<CardsSkeletonProps> = ({ count = 4 }) => {
  return (
    <div className="space-y-6 p-4">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <Card
            key={idx}
            className="bg-[var(--card)] border-[var(--border)] rounded-md shadow-sm p-4 h-44 animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[var(--muted)] rounded-full" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-4 bg-[var(--muted)] rounded w-3/4"></div>
                <div className="h-3 bg-[var(--muted)] rounded w-1/2"></div>
              </div>
              <div className="h-5 px-2 bg-[var(--muted)] rounded-full w-12"></div>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-3 bg-[var(--muted)] rounded w-full"></div>
              <div className="h-3 bg-[var(--muted)] rounded w-5/6"></div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-3 bg-[var(--muted)] rounded w-10"></div>
              <div className="h-3 bg-[var(--muted)] rounded w-16"></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
