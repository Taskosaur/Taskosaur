import { useState, useEffect, useRef, useMemo, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/router";
import { HiCalendarDays, HiClipboardDocumentList } from "react-icons/hi2";
import type { Task, TaskGanttViewProps, TimeRange, ViewMode } from "@/types";
import { TaskInfoPanel } from "@/components/gantt/TaskInfoPanel";
import { getViewModeWidth, parseDate } from "@/utils/gantt";
import { TaskBar } from "@/components/gantt/TaskBar";
import { TimelineHeader } from "@/components/gantt/TimelineHeader";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui";
import TaskTableSkeleton from "@/components/skeletons/TaskTableSkeleton";

const MINIMUM_ROWS = 9;

// Utility to validate slug strings: alphanumeric and dash only
function sanitizeSlug(slug: string | undefined): string | undefined {
  return slug && /^[a-zA-Z0-9\-]+$/.test(slug) ? slug : undefined;
}

export default function TaskGanttView({
  tasks,
  workspaceSlug,
  projectSlug,
  viewMode: externalViewMode,
  onViewModeChange,
}: TaskGanttViewProps) {
  const router = useRouter();

  const [ganttTasks, setGanttTasks] = useState<Task[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: new Date(),
    end: new Date(),
    days: [],
  });
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [focusedTask, setFocusedTask] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("days");
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;

  // Sanitize slugs for security
  const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
  const safeProjectSlug = sanitizeSlug(projectSlug);
  const safeTasks = tasks || [];

  // Process tasks and generate time range
  const processedTasksData = useMemo(() => {
    try {
      setError(null);
      setIsLoading(true);

      const processedTasks = safeTasks.map((task, index) => {
        let startDate = task.startDate;
        let dueDate = task.dueDate;

        if (!startDate && !dueDate) {
          if (task.createdAt) {
            const createdDate = parseDate(task.createdAt);
            startDate = createdDate.toISOString();
            dueDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          } else {
            const today = new Date();
            startDate = new Date(today.getTime() + index * 24 * 60 * 60 * 1000).toISOString();
            dueDate = new Date(today.getTime() + (index + 7) * 24 * 60 * 60 * 1000).toISOString();
          }
        } else if (!startDate && dueDate) {
          const due = parseDate(dueDate);
          startDate = new Date(due.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (startDate && !dueDate) {
          const start = parseDate(startDate);
          dueDate = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }

        return { ...task, startDate, dueDate };
      });

      let earliest = new Date();
      let latest = new Date();

      if (processedTasks.length > 0) {
        const allDates = processedTasks.flatMap((task) => [
          parseDate(task.startDate),
          parseDate(task.dueDate),
        ]);
        earliest = new Date(Math.min(...allDates.map((d) => d.getTime())));
        latest = new Date(Math.max(...allDates.map((d) => d.getTime())));
        earliest.setDate(earliest.getDate() - 2);
        latest.setDate(latest.getDate() + 2);
      }

      return { processedTasks, earliest, latest };
    } catch (error) {
      console.error("Error processing Gantt tasks:", error);
      setError(error instanceof Error ? error.message : "Failed to process tasks");
      return { processedTasks: [], earliest: new Date(), latest: new Date() };
    } finally {
      setIsLoading(false);
    }
  }, [safeTasks]);

  // Generate time scale
  const generateTimeScale = useCallback((start: Date, end: Date, mode: ViewMode) => {
    const scale: Date[] = [];
    const current = new Date(start);

    try {
      switch (mode) {
        case "days":
          while (current <= end && scale.length < 1000) {
            scale.push(new Date(current));
            current.setDate(current.getDate() + 1);
          }
          break;
        case "weeks":
          current.setDate(current.getDate() - current.getDay());
          while (current <= end && scale.length < 200) {
            scale.push(new Date(current));
            current.setDate(current.getDate() + 7);
          }
          break;
        case "months":
          current.setDate(1);
          while (current <= end && scale.length < 60) {
            scale.push(new Date(current));
            current.setMonth(current.getMonth() + 1);
          }
          break;
      }
    } catch (error) {
      console.error("Error generating time scale:", error);
      return [new Date()];
    }

    return scale;
  }, []);

  // Update state when processed data changes
  useEffect(() => {
    const { processedTasks, earliest, latest } = processedTasksData;
    const days = generateTimeScale(earliest, latest, viewMode);
    setGanttTasks(processedTasks);
    setTimeRange({ start: earliest, end: latest, days });
  }, [processedTasksData, viewMode, generateTimeScale]);

  const displayRows = useMemo(() => {
    const rows = [];

    // Add actual tasks
    for (const task of ganttTasks) {
      rows.push({ type: "task", data: task });
    }

    // Only add empty rows if we have fewer than the minimum required
    if (ganttTasks.length < MINIMUM_ROWS) {
      const emptyRowsNeeded = MINIMUM_ROWS - ganttTasks.length;
      for (let i = 0; i < emptyRowsNeeded; i++) {
        rows.push({ type: "empty", data: null });
      }
    }

    return rows;
  }, [ganttTasks]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, task: Task) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const href =
          safeWorkspaceSlug && safeProjectSlug
            ? `/${safeWorkspaceSlug}/${safeProjectSlug}/tasks/${task.id}`
            : safeWorkspaceSlug
              ? `/${safeWorkspaceSlug}/tasks/${task.id}`
              : `/tasks/${task.id}`;
        router.push(href);
      }
    },
    [safeWorkspaceSlug, safeProjectSlug, router]
  );

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (scrollContainerRef.current && timeRange.days.length > 0) {
      try {
        const today = new Date();
        const todayIndex = timeRange.days.findIndex(
          (day) => day.toDateString() === today.toDateString()
        );
        if (todayIndex !== -1) {
          const cellWidth = getViewModeWidth(viewMode);
          const scrollPosition = todayIndex * cellWidth;
          const containerWidth = scrollContainerRef.current.clientWidth;
          const targetPosition = Math.max(0, scrollPosition - containerWidth / 2);

          scrollContainerRef.current.scrollTo({
            left: targetPosition,
            behavior: "smooth",
          });
        }
      } catch (error) {
        console.error("Error scrolling to today:", error);
      }
    }
  }, [timeRange.days, viewMode]);

  const EmptyRow = ({ index }: { index: number }) => (
    <div
      className="flex items-center border-b border-[var(--border)] hover:bg-[var(--accent)]"
      role="row"
      aria-label={`Empty row ${index + 1}`}
    >
      {/* Empty Task Info Panel */}
      <div className="flex-shrink-0 w-80 border-r border-[var(--border)] bg-[var(--card)] py-1 sticky left-0 z-10">
        <div className={`${isCompact ? "p-6" : "p-7"} flex items-center gap-3 text-sm`}>
          {/* Empty row content */}
        </div>
      </div>

      {/* Empty Timeline */}
      <div className="flex-1 relative">
        <div>
          {timeRange.days.map((day, dayIndex) => {
            const cellWidth = getViewModeWidth(viewMode);
            return (
              <div
                key={dayIndex}
                className="border-r border-[var(--border)]/30 bg-[var(--card)]"
                style={{ width: `${cellWidth}px` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!safeTasks.length) {
    return <TaskTableSkeleton />;
  }

  if (safeTasks.length === 0) {
    return (
      <Card className="border-none bg-[var(--card)]">
        <CardContent className="p-8 text-center">
          <HiClipboardDocumentList
            size={48}
            className="mx-auto text-[var(--muted-foreground)] mb-4"
          />
          <CardTitle className="text-lg font-medium mb-2 text-[var(--foreground)]">
            No tasks yet
          </CardTitle>
          <CardDescription className="text-sm text-[var(--muted-foreground)] mb-6">
            Create your first task to get started with project management.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="w-full bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] overflow-hidden"
      role="main"
      aria-label="Gantt chart timeline view"
    >
      {/* Error Display */}
      {error && (
        <div
          className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-sm z-50 flex items-center justify-center"
          role="status"
          aria-label="Loading timeline"
        >
          <div className="bg-[var(--card)] rounded-lg p-4 shadow-lg border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--primary)] border-t-transparent"></div>
              <span className="text-sm font-medium text-[var(--foreground)]">
                Loading timeline...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Container */}
      <div
        className="overflow-x-auto overflow-y-auto"
        ref={scrollContainerRef}
        role="application"
        aria-label="Interactive Gantt chart timeline"
        tabIndex={0}
        onScroll={() => {
          setHoveredTask(null);
        }}
      >
        <div className="flex flex-col min-w-fit">
          {/* Timeline Header */}
          <TimelineHeader
            timeRange={timeRange}
            viewMode={viewMode}
            isCompact={isCompact}
            scrollToToday={scrollToToday}
          />

          {/* Task Rows */}
          {/* Task Rows */}
          <div className="flex flex-col z-20" role="rowgroup">
            {displayRows.map((row, index) => {
              if (row.type === "task" && row.data) {
                const task = row.data;
                const taskEnd = parseDate(task.dueDate);
                const isOverdue =
                  taskEnd < new Date() && task.status?.name?.toLowerCase() !== "done";
                const isHovered = hoveredTask === task.id;
                const isFocused = focusedTask === task.id;

                return (
                  <div
                    key={task.id}
                    ref={(el) => {
                      if (el) {
                        taskRefs.current.set(task.id, el);
                      } else {
                        taskRefs.current.delete(task.id);
                      }
                    }}
                    className={`flex items-center border-b border-[var(--border)] hover:bg-[var(--accent)] focus-within:bg-[var(--accent)] 
           ${isHovered ? "bg-[var(--accent)] " : ""} ${
             isFocused ? "bg-[var(--accent)] ring-2 ring-[var(--ring)] ring-offset-2" : ""
           } ${isOverdue ? "bg-red-50 dark:bg-red-900/10 " : ""}`}
                    onMouseEnter={() => setHoveredTask(task.id)}
                    onMouseLeave={() => setHoveredTask(null)}
                    onKeyDown={(e) => handleKeyDown(e, task)}
                    tabIndex={0}
                    role="row"
                    aria-label={`Task: ${task.title}, Status: ${task.status?.name}, ${
                      isOverdue ? "Overdue" : `Due ${new Date(task.dueDate!).toLocaleDateString()}`
                    }`}
                  >
                    {/* Task Info Panel */}
                    <TaskInfoPanel
                      task={task}
                      isCompact={isCompact}
                      isOverdue={isOverdue}
                      workspaceSlug={safeWorkspaceSlug}
                      projectSlug={safeProjectSlug}
                      onFocus={setFocusedTask}
                    />

                    {/* Task Bar */}
                    <TaskBar
                      task={task}
                      timeRange={timeRange}
                      viewMode={viewMode}
                      isCompact={isCompact}
                      isHovered={isHovered}
                      isFocused={isFocused}
                      workspaceSlug={safeWorkspaceSlug}
                      projectSlug={safeProjectSlug}
                      onHover={setHoveredTask}
                      onFocus={setFocusedTask}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                );
              }

              // Empty row
              return <EmptyRow key={`empty-${index}`} index={index} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
