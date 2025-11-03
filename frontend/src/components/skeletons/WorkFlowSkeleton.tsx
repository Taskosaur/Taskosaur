import React from "react";
import { Skeleton } from "../ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "../ui";
const WorkFlowSkeleton = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Sidebar Skeleton */}
      <div className="lg:col-span-1">
        <Card className="bg-[var(--sidebar)] border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--foreground)]">
              <Skeleton className="h-4 w-1/3" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--card)]/20 animate-pulse">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-4 w-12 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full mt-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Skeleton */}
      <div className="lg:col-span-3 space-y-4">
        {/* Tabs */}
        <div className="border-b border-[var(--border)] mb-4">
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-t-md" />
            ))}
          </div>
        </div>

        {/* Overview Card */}
        <Card className="bg-[var(--sidebar)] border-none shadow-sm">
          <CardContent className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-2 w-full">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Flow Skeleton */}
        <Card className="bg-[var(--card)] border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-semibold text-[var(--foreground)]">
              <Skeleton className="h-4 w-1/4" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  {i < 4 && <Skeleton className="w-4 h-4 rounded-full" />}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkFlowSkeleton;
