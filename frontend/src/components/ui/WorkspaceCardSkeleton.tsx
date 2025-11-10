import React from "react";
import { Card } from "@/components/ui";

export const WorkspaceCardSkeleton: React.FC = () => (
  <Card className="workspace-item-card animate-pulse">
    <div className="workspace-item-header">
      <div className="w-7 h-7 rounded-lg bg-stone-200 dark:bg-stone-700"></div>
      <div className="workspace-item-info">
        <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-1/2"></div>
      </div>
    </div>
    <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-full mb-2"></div>
    <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-2/3 mb-3"></div>
    <div className="workspace-item-stats">
      <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-16"></div>
      <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-16"></div>
    </div>
  </Card>
);
