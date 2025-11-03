import { TimeRange, ViewMode } from "@/types";

export const getPriorityColor = (priority: string | undefined): string => {
  switch (priority?.toLowerCase()) {
    case "highest":
      return "text-red-600 bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-700";
    case "high":
      return "text-orange-600 bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700";
    case "medium":
      return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700";
    case "low":
      return "text-green-600 bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-700";
    case "lowest":
      return "text-blue-600 bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700";
    default:
      return "text-[var(--foreground)] bg-[var(--muted)] border-[var(--border)]";
  }
};

export const getStatusColor = (
  statusName: string | undefined
): { bg: string; border: string; text: string } => {
  switch (statusName?.toLowerCase()) {
    case "done":
    case "completed":
      return {
        bg: "bg-green-500",
        border: "border-green-400",
        text: "text-white",
      };
    case "in progress":
    case "in_progress":
      return {
        bg: "bg-blue-500",
        border: "border-blue-400",
        text: "text-white",
      };
    case "review":
      return {
        bg: "bg-[var(--primary)]",
        border: "border-[var(--primary)]",
        text: "text-[var(--primary-foreground)]",
      };
    case "todo":
      return {
        bg: "bg-[var(--muted)]",
        border: "border-[var(--border)]",
        text: "text-[var(--foreground)]",
      };
    default:
      return {
        bg: "bg-[var(--muted)]",
        border: "border-[var(--border)]",
        text: "text-[var(--foreground)]",
      };
  }
};

export const getPriorityColors = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case "highest":
      return {
        bg: "bg-gradient-to-r from-red-500 to-red-600",
        border: "border-red-400",
        shadow: "shadow-red-200 dark:shadow-red-900/50",
      };
    case "high":
      return {
        bg: "bg-gradient-to-r from-orange-500 to-orange-600",
        border: "border-orange-400",
        shadow: "shadow-orange-200 dark:shadow-orange-900/50",
      };
    case "medium":
      return {
        bg: "bg-gradient-to-r from-yellow-500 to-yellow-600",
        border: "border-yellow-400",
        shadow: "shadow-yellow-200 dark:shadow-yellow-900/50",
      };
    case "low":
    default:
      return {
        bg: "bg-gradient-to-r from-green-500 to-green-600",
        border: "border-green-400",
        shadow: "shadow-green-200 dark:shadow-green-900/50",
      };
  }
};

// Utility functions
export const parseDate = (dateString: string | undefined): Date => {
  if (!dateString) return new Date();
  try {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  } catch (error) {
    return new Date();
  }
};

export const getViewModeWidth = (viewMode: ViewMode): number => {
  switch (viewMode) {
    case "days":
      return 80;
    case "weeks":
      return 140;
    case "months":
      return 200;
    default:
      return 80;
  }
};

export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};

export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Helper function to calculate position and width based on view mode
export const calculateTaskPosition = (
  taskStart: Date,
  taskEnd: Date,
  timeRange: TimeRange,
  viewMode: ViewMode
) => {
  const cellWidth = getViewModeWidth(viewMode);

  if (viewMode === "days") {
    // For days view, use the existing logic
    const startOffset = Math.max(0, daysBetween(timeRange.start, taskStart));
    const duration = Math.max(1, daysBetween(taskStart, taskEnd) + 1);
    const totalDays = timeRange.days.length;

    const adjustedDuration = Math.min(duration, totalDays - startOffset);
    const actualDuration = Math.max(1, adjustedDuration);

    const barLeft = startOffset * cellWidth;
    const barWidth = Math.max(actualDuration * cellWidth, cellWidth * 0.5);
    const maxWidth = (totalDays - startOffset) * cellWidth;
    const finalBarWidth = Math.min(barWidth, maxWidth);

    return { barLeft, finalBarWidth, actualDuration };
  }

  // For weeks and months view, we need to find which time period the task starts and ends in
  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < timeRange.days.length; i++) {
    const periodStart = timeRange.days[i];
    let periodEnd: Date;

    if (viewMode === "weeks") {
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 6);
    } else {
      // months
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
    }

    // Check if task starts in this period
    if (startIndex === -1 && taskStart >= periodStart && taskStart <= periodEnd) {
      startIndex = i;
    }

    // Check if task ends in this period
    if (taskEnd >= periodStart && taskEnd <= periodEnd) {
      endIndex = i;
    }
  }

  // If we couldn't find exact matches, use the closest periods
  if (startIndex === -1) {
    startIndex = 0;
    for (let i = 0; i < timeRange.days.length - 1; i++) {
      if (taskStart >= timeRange.days[i] && taskStart < timeRange.days[i + 1]) {
        startIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) {
    endIndex = Math.max(startIndex, timeRange.days.length - 1);
    for (let i = timeRange.days.length - 1; i >= 0; i--) {
      let periodEnd: Date;
      if (viewMode === "weeks") {
        periodEnd = new Date(timeRange.days[i]);
        periodEnd.setDate(periodEnd.getDate() + 6);
      } else {
        periodEnd = new Date(timeRange.days[i]);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
      }

      if (taskEnd >= timeRange.days[i]) {
        endIndex = i;
        break;
      }
    }
  }

  // Ensure endIndex is at least startIndex
  endIndex = Math.max(startIndex, endIndex);

  const barLeft = startIndex * cellWidth;
  const spanCount = endIndex - startIndex + 1;
  const finalBarWidth = spanCount * cellWidth;

  return { barLeft, finalBarWidth, actualDuration: spanCount };
};
