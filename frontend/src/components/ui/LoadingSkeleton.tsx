import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("max-w-7xl mx-auto p-6", className)}>
      <div className="animate-pulse">
        <div className="h-6 skeleton-secondary w-1/4 mb-3"></div>
        <div className="h-4 skeleton-secondary w-1/2 mb-6"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-4">
              <div className="h-5 skeleton-secondary w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 skeleton-secondary"></div>
                <div className="h-4 skeleton-secondary"></div>
                <div className="h-4 skeleton-secondary"></div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-4">
              <div className="h-5 skeleton-secondary w-1/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 skeleton-secondary"></div>
                <div className="h-4 skeleton-secondary"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
