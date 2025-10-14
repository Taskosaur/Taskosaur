import React from "react";
import { Skeleton } from "../ui/skeleton";
import { Card, CardContent, CardHeader } from "../ui";
const WorkspaceMembersSkeleton = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-pulse">
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardHeader className="px-4 py-0">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-9 w-64 rounded" />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="px-4 py-3 bg-[var(--muted)]/30 border-b border-[var(--border)]">
              <div className="grid grid-cols-12 gap-3 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <Skeleton className="col-span-4 h-8 w-full rounded" />
                    <Skeleton className="col-span-2 h-6 w-16 rounded" />
                    <Skeleton className="col-span-2 h-6 w-20 rounded" />
                    <Skeleton className="col-span-2 h-6 w-20 rounded" />
                    <Skeleton className="col-span-2 h-6 w-10 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>

        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkspaceMembersSkeleton;
