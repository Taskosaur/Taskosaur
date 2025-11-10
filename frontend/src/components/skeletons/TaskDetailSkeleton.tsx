import React from "react";

interface TaskDetailSkeletonProps {
  showAttachmentSection?: boolean;
  showSubtasks?: boolean;
}

// Reusable skeleton primitive components
const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-[var(--skeleton)] rounded ${className}`} />
);

const SkeletonText = ({
  width = "w-full",
  height = "h-4",
}: {
  width?: string;
  height?: string;
}) => <div className={`animate-pulse bg-[var(--skeleton)] rounded ${height} ${width}`} />;

const SkeletonCircle = ({ size = "w-8 h-8" }: { size?: string }) => (
  <div className={`animate-pulse bg-[var(--skeleton)] rounded-full ${size}`} />
);

// Section Header Skeleton
const SectionHeaderSkeleton = () => (
  <div className="flex items-center gap-2 mb-4">
    <SkeletonCircle size="w-4 h-4" />
    <SkeletonText width="w-32" height="h-5" />
  </div>
);

// Header Section Skeleton
const HeaderSkeleton = () => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center gap-4">
        {/* Title */}
        <SkeletonText width="w-64" height="h-7" />

        {/* Expand button (for modal view) */}
        <SkeletonBox className="w-5 h-5" />
      </div>

      {/* Created by info */}
      <SkeletonText width="w-48" height="h-4" />
    </div>

    {/* Action buttons */}
    <div className="flex gap-2">
      <SkeletonBox className="w-10 h-10 rounded-md" />
      <SkeletonBox className="w-10 h-10 rounded-md" />
    </div>
  </div>
);

// Task Description Skeleton
const DescriptionSkeleton = () => (
  <div className="space-y-3">
    <SkeletonText width="w-full" height="h-4" />
    <SkeletonText width="w-5/6" height="h-4" />
    <SkeletonText width="w-4/5" height="h-4" />
    <SkeletonText width="w-full" height="h-4" />
    <SkeletonText width="w-3/4" height="h-4" />
  </div>
);

// Attachments Section Skeleton
const AttachmentsSkeleton = () => (
  <div className="space-y-4">
    <SectionHeaderSkeleton />

    <div className="space-y-3">
      {[...Array(3)].map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg bg-[var(--muted)]/30"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <SkeletonCircle size="w-4 h-4" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonText width="w-32" height="h-4" />
              <SkeletonText width="w-24" height="h-3" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SkeletonBox className="h-8 w-8 rounded" />
            <SkeletonBox className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>

    {/* Upload button placeholder */}
    <div className="flex justify-end">
      <SkeletonBox className="w-40 h-10 rounded-md" />
    </div>
  </div>
);

// Subtasks Section Skeleton
const SubtasksSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <SkeletonCircle size="w-5 h-5" />
        <SkeletonText width="w-40" height="h-5" />
      </div>
    </div>

    <div className="space-y-2">
      {[...Array(3)].map((_, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 p-3 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]"
        >
          <SkeletonBox className="w-4 h-4 rounded mt-0.5" />
          <div className="flex-1 space-y-2">
            <SkeletonText width="w-3/4" height="h-4" />
            <div className="flex gap-2">
              <SkeletonBox className="w-16 h-5 rounded-full" />
              <SkeletonBox className="w-16 h-5 rounded-full" />
              <SkeletonBox className="w-20 h-5 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Add subtask button */}
    <div className="flex justify-end">
      <SkeletonBox className="w-40 h-10 rounded-md" />
    </div>
  </div>
);

// Comments Section Skeleton
const CommentsSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-2">
        <div className="p-1 rounded-md">
          <SkeletonCircle size="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <SkeletonText width="w-24" height="h-5" />
          <SkeletonText width="w-32" height="h-3" />
        </div>
      </div>
    </div>

    {/* Comments list */}
    <div className="space-y-4">
      {[...Array(3)].map((_, idx) => (
        <div key={idx} className="flex gap-3">
          <SkeletonCircle size="w-8 h-8" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonText width="w-32" height="h-4" />
              <SkeletonText width="w-20" height="h-3" />
            </div>
            <SkeletonText width="w-full" height="h-16" />
          </div>
        </div>
      ))}
    </div>

    {/* Comment editor */}
    <div className="space-y-2">
      <SkeletonBox className="w-full h-32 rounded-md" />
      <div className="flex justify-end gap-2">
        <SkeletonBox className="w-32 h-10 rounded-md" />
      </div>
    </div>
  </div>
);

// Right Sidebar Skeleton
const SidebarSkeleton = () => (
  <div className="space-y-6">
    {/* Email Replies Toggle */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-24" height="h-4" />
        <SkeletonBox className="w-10 h-5 rounded-full" />
      </div>
    </div>

    {/* Task Type */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-20" height="h-4" />
        <SkeletonText width="w-8" height="h-4" />
      </div>
      <SkeletonBox className="w-full h-8 rounded-2xl" />
    </div>

    {/* Priority */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-16" height="h-4" />
        <SkeletonText width="w-8" height="h-4" />
      </div>
      <SkeletonBox className="w-full h-8 rounded-2xl" />
    </div>

    {/* Status */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-16" height="h-4" />
        <SkeletonText width="w-8" height="h-4" />
      </div>
      <SkeletonBox className="w-full h-8 rounded-2xl" />
    </div>

    {/* Date Range */}
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-24" height="h-4" />
        <SkeletonText width="w-8" height="h-4" />
      </div>

      {/* Start Date */}
      <div className="space-y-2">
        <SkeletonText width="w-20" height="h-3" />
        <SkeletonBox className="w-full h-8 rounded-2xl" />
      </div>

      {/* Due Date */}
      <div className="space-y-2">
        <SkeletonText width="w-20" height="h-3" />
        <SkeletonBox className="w-full h-8 rounded-2xl" />
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-[var(--border)] pt-4">
      <SkeletonText width="w-24" height="h-4" />
    </div>

    {/* Assignees */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-20" height="h-4" />
        <SkeletonText width="w-8" height="h-4" />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonCircle size="w-8 h-8" />
        <SkeletonCircle size="w-8 h-8" />
        <SkeletonCircle size="w-8 h-8" />
      </div>
    </div>

    {/* Reporters */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-20" height="h-4" />
        <SkeletonText width="w-8" height="h-4" />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonCircle size="w-8 h-8" />
        <SkeletonCircle size="w-8 h-8" />
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-[var(--border)] pt-4">
      <SkeletonText width="w-16" height="h-4" />
    </div>

    {/* Labels */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-24" height="h-4" />
        <SkeletonText width="w-8" height="h-4" />
      </div>
      <div className="flex flex-wrap gap-2">
        <SkeletonBox className="w-20 h-6 rounded-full" />
        <SkeletonBox className="w-24 h-6 rounded-full" />
        <SkeletonBox className="w-16 h-6 rounded-full" />
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-[var(--border)] pt-4">
      <SkeletonText width="w-20" height="h-4" />
    </div>

    {/* Activities */}
    <div className="space-y-3">
      {[...Array(4)].map((_, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <SkeletonCircle size="w-2 h-2 mt-1.5" />
          <div className="flex-1 space-y-1">
            <SkeletonText width="w-full" height="h-4" />
            <SkeletonText width="w-20" height="h-3" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Main Skeleton Component
export default function TaskDetailSkeleton({
  showAttachmentSection = true,
  showSubtasks = true,
}: TaskDetailSkeletonProps) {
  return (
    <div className="dashboard-container">
      <div className="space-y-3">
        {/* Header Section */}
        <HeaderSkeleton />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 p-0 justify-between">
          {/* Left Content Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description Section */}
            <div className="border-none">
              <DescriptionSkeleton />
            </div>

            {/* Attachments Section */}
            {showAttachmentSection && (
              <div className="border-none">
                <AttachmentsSkeleton />
              </div>
            )}

            {/* Subtasks Section */}
            {showSubtasks && (
              <div className="border-none">
                <SubtasksSkeleton />
              </div>
            )}

            {/* Comments Section */}
            <div className="border-none">
              <CommentsSkeleton />
            </div>
          </div>

          {/* Right Sidebar Column (1/3 width) */}
          <div className="lg:col-span-1 space-y-4 lg:max-w-[18vw] w-full">
            <SidebarSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
