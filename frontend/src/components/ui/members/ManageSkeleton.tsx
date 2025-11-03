import React from "react";
import { Skeleton } from "../skeleton";
import { Card, CardContent } from "../card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

interface DynamicManageSkeletonProps {
  entityType?: "organization" | "workspace" | "project";
  showTabs?: boolean;
  tabCount?: number;
  showHeader?: boolean;
  showInfoCard?: boolean;
}

const DynamicManageSkeleton: React.FC<DynamicManageSkeletonProps> = ({
  entityType = "organization",
  showTabs = true,
  tabCount = 3,
  showHeader = true,
  showInfoCard = true,
}) => {
  const renderTabTriggers = () => {
    return Array.from({ length: tabCount }).map((_, index) => (
      <TabsTrigger
        key={index}
        value={`tab-${index}`}
        className="flex items-center justify-center gap-2 px-3 py-2 bg-transparent cursor-pointer"
      >
        <Skeleton className="h-4 w-20 rounded" />
      </TabsTrigger>
    ));
  };

  const renderMemberRows = (count: number = 5) => {
    return Array.from({ length: count }).map((_, i) => (
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
    ));
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto p-4 space-y-4 animate-pulse">
        {/* Page Header */}
        {showHeader && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-[var(--muted)] flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-3 w-80 rounded" />
            </div>
          </div>
        )}

        {/* Entity Info Card */}
        {showInfoCard && (
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
        )}

        {/* Content based on whether tabs are shown */}
        {showTabs ? (
          <Tabs defaultValue="tab-0">
            {/* Tab Headers */}
            <div className="border-b border-[var(--border)]">
              <TabsList className={`grid grid-cols-${tabCount} w-full bg-transparent p-0 h-auto`}>
                {renderTabTriggers()}
              </TabsList>
            </div>

            {/* Tab Contents */}
            {Array.from({ length: tabCount }).map((_, index) => (
              <TabsContent key={index} value={`tab-${index}`} className="space-y-4 mt-4">
                <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    {index === 0 ? (
                      // Settings-like content
                      <>
                        <Skeleton className="h-4 w-56 rounded" />
                        <Skeleton className="h-3 w-72 rounded" />
                        <Skeleton className="h-3 w-2/3 rounded" />
                        <Skeleton className="h-3 w-5/6 rounded" />
                      </>
                    ) : index === 1 ? (
                      // Workflows-like content
                      <>
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-5 h-5 rounded" />
                          <Skeleton className="h-4 w-40 rounded" />
                        </div>
                        <Skeleton className="h-3 w-3/4 rounded" />
                        <Skeleton className="h-3 w-5/6 rounded" />
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
                      </>
                    ) : (
                      // Members-like content
                      <div className="space-y-3">{renderMemberRows()}</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          // Non-tabbed layout (for simple member pages)
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Members List */}
            <div className="lg:col-span-2">
              <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
                <CardContent className="p-4">
                  {/* Header with search */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-5 h-5 rounded" />
                      <Skeleton className="h-4 w-32 rounded" />
                    </div>
                    <Skeleton className="h-9 w-64 rounded" />
                  </div>

                  {/* Table header */}
                  <div className="px-4 py-3 bg-[var(--muted)]/30 border-b border-[var(--border)] mb-4">
                    <div className="grid grid-cols-12 gap-3">
                      <Skeleton className="col-span-4 h-3 rounded" />
                      <Skeleton className="col-span-2 h-3 rounded" />
                      <Skeleton className="col-span-2 h-3 rounded" />
                      <Skeleton className="col-span-2 h-3 rounded" />
                      <Skeleton className="col-span-2 h-3 rounded" />
                    </div>
                  </div>

                  {/* Member rows */}
                  <div className="space-y-3">{renderMemberRows()}</div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Info Card */}
              <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                  </div>
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <div className="space-y-2 mt-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-3 w-12 rounded" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Role Distribution Card */}
              <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-4 w-32 rounded" />
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-5 w-8 rounded-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Invitations Card */}
              <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm h-[270px]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-4 w-28 rounded" />
                  </div>
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-3 w-32 rounded" />
                          <Skeleton className="h-2 w-24 rounded mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicManageSkeleton;
