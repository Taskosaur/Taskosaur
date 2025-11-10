import { Skeleton } from "@/components/ui/skeleton";

function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col space-y-2 pb-4 mb-6">
      {/* Title and Description */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          {/* Title skeleton */}
          <Skeleton className="h-8 w-32" />
          {/* Description skeleton */}
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Actions skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" /> {/* Refresh button */}
          <Skeleton className="h-9 w-9" /> {/* Settings dropdown */}
        </div>
      </div>
    </div>
  );
}

export { PageHeaderSkeleton };
