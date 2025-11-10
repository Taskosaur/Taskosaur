import React from "react";
import { Skeleton } from "../ui/skeleton";
import { Card, CardContent } from "../ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const OrganizationManageSkeleton = () => {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto p-4 space-y-4 animate-pulse">
        {/* Page Header */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--muted)] flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-3 w-80 rounded" />
          </div>
        </div>

        {/* Organization Info Card */}
        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-3 w-64 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-12 rounded" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Skeleton */}
        <Tabs defaultValue="settings">
          {/* Tab Headers */}
          <div className="border-b border-[var(--border)]">
            <TabsList className="grid grid-cols-3 w-full bg-transparent p-0 h-auto">
              <TabsTrigger
                value="settings"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-transparent cursor-pointer"
              >
                <Skeleton className="h-4 w-20 rounded" />
              </TabsTrigger>
              <TabsTrigger
                value="workflows"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-transparent cursor-pointer"
              >
                <Skeleton className="h-4 w-24 rounded" />
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-transparent cursor-pointer"
              >
                <Skeleton className="h-4 w-20 rounded" />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-56 rounded" />
                <Skeleton className="h-3 w-72 rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-4 mt-4">
            <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-5 h-5 rounded" />
                  <Skeleton className="h-4 w-40 rounded" />
                </div>
                <Skeleton className="h-3 w-3/4 rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />

                {/* Workflow list placeholder */}
                <div className="space-y-3 mt-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]/30"
                    >
                      <Skeleton className="h-4 w-40 rounded" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-5 w-5 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4 mt-4">
            <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
              <CardContent className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div>
                        <Skeleton className="h-3 w-32 rounded" />
                        <Skeleton className="h-3 w-24 rounded mt-1" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default OrganizationManageSkeleton;
