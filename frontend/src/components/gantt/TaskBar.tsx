import { Task } from "@/types";
import { formatDateForDisplay } from "@/utils/date";
import { TimeRange, ViewMode } from "@/types";
import {
  calculateTaskPosition,
  getPriorityColors,
  getViewModeWidth,
  parseDate,
} from "@/utils/gantt";
import { useRouter } from "next/router";
import { type KeyboardEvent, useState, useEffect, useRef, memo, useMemo } from "react";
import { StatusBadge } from "../ui";
import { HiCheckCircle, HiClock } from "react-icons/hi";
import { HiExclamationTriangle } from "react-icons/hi2";
import { isDateOverdue as checkDateOverdue } from "@/utils/date";

interface TaskBarProps {
  task: Task;
  timeRange: TimeRange;
  viewMode: ViewMode;
  isCompact: boolean;
  isHovered: boolean;
  isFocused: boolean;
  workspaceSlug: string;
  projectSlug?: string;
  onHover: (taskId: string | null) => void;
  onFocus: (taskId: string | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>, task: Task) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => Promise<void>;
}

// Task Bar Component
export const TaskBar: React.FC<TaskBarProps> = memo(({
  task,
  timeRange,
  viewMode,
  isCompact,
  isHovered,
  isFocused,
  workspaceSlug,
  projectSlug,
  onHover,
  onFocus,
  onKeyDown,
  onTaskUpdate,
}) => {
  const router = useRouter();
  
  // State for resizing/moving
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'left' | 'right' | 'move' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [deltaDays, setDeltaDays] = useState(0);
  const justResized = useRef(false);

  // Tooltip sits above the bar, unless the sticky timeline header would clip it.
  const barRef = useRef<HTMLDivElement>(null);
  const [flipTooltipDown, setFlipTooltipDown] = useState(false);

  // ponytail: constant clearance, not a measured tooltip/header height.
  // Swap for a measured value (or floating-ui) if the tooltip content grows.
  const TOOLTIP_CLEARANCE = 150;
  const updateTooltipSide = () => {
    const bar = barRef.current;
    if (!bar) return;
    const scroller = bar.closest(".overflow-y-auto");
    const scrollerTop = scroller ? scroller.getBoundingClientRect().top : 0;
    setFlipTooltipDown(bar.getBoundingClientRect().top - scrollerTop < TOOLTIP_CLEARANCE);
  };

  const taskStart = useMemo(() => parseDate(task.startDate), [task.startDate]);
  const taskEnd = useMemo(() => parseDate(task.dueDate), [task.dueDate]);

  // Interaction Handlers
  const handleInteractionStart = (e: React.MouseEvent, direction: 'left' | 'right' | 'move') => {
    e.stopPropagation(); // Prevent navigation click and parent dragging
    setIsResizing(true);
    justResized.current = false;
    setResizeDirection(direction);
    setDragStartX(e.clientX);
    setDeltaDays(0);
    onFocus(task.id);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      justResized.current = true;
      const deltaX = e.clientX - dragStartX;
      const cellWidth = getViewModeWidth(viewMode);
      
      let daysPerCell = 1;
      if (viewMode === 'weeks') daysPerCell = 7;
      if (viewMode === 'months') daysPerCell = 30; // Approx
      
      const deltaUnits = deltaX / cellWidth;
      const deltaDaysCalc = Math.round(deltaUnits * daysPerCell);
      
      setDeltaDays(deltaDaysCalc);
    };

    const handleMouseUp = async (e: MouseEvent) => {
      setIsResizing(false);
      setResizeDirection(null);
      setDeltaDays(0);
      
      const deltaX = e.clientX - dragStartX;
      const cellWidth = getViewModeWidth(viewMode);
      let daysPerCell = 1;
      if (viewMode === 'weeks') daysPerCell = 7;
      if (viewMode === 'months') daysPerCell = 30;
      const finalDeltaDays = Math.round((deltaX / cellWidth) * daysPerCell);
      
      let finalStart = new Date(taskStart);
      let finalEnd = new Date(taskEnd);

      if (resizeDirection === 'left') {
        finalStart.setDate(finalStart.getDate() + finalDeltaDays);
        if (finalStart > taskEnd) {
          finalStart = new Date(taskEnd);
        }
      } else if (resizeDirection === 'right') {
        finalEnd.setDate(finalEnd.getDate() + finalDeltaDays);
        if (finalEnd < taskStart) {
          finalEnd = new Date(taskStart);
        }
      } else if (resizeDirection === 'move') {
        finalStart.setDate(finalStart.getDate() + finalDeltaDays);
        finalEnd.setDate(finalEnd.getDate() + finalDeltaDays);
      }
      
      const hasChanged = 
        finalStart.getTime() !== taskStart.getTime() || 
        finalEnd.getTime() !== taskEnd.getTime();

      if (onTaskUpdate && hasChanged) {
        await onTaskUpdate(task.id, {
          startDate: finalStart.toISOString(),
          dueDate: finalEnd.toISOString()
        });
      }
      setTimeout(() => {
        justResized.current = false;
      }, 100);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, dragStartX, taskStart, taskEnd, viewMode, onTaskUpdate, task.id, resizeDirection]);

  // Derive current dates based on resize state
  let currentStart = new Date(taskStart);
  let currentEnd = new Date(taskEnd);

  if (isResizing) {
    if (resizeDirection === 'left') {
      currentStart.setDate(currentStart.getDate() + deltaDays);
      if (currentStart > taskEnd) {
        currentStart = new Date(taskEnd);
      }
    } else if (resizeDirection === 'right') {
      currentEnd.setDate(currentEnd.getDate() + deltaDays);
      if (currentEnd < taskStart) {
        currentEnd = new Date(taskStart);
      }
    } else if (resizeDirection === 'move') {
      currentStart.setDate(currentStart.getDate() + deltaDays);
      currentEnd.setDate(currentEnd.getDate() + deltaDays);
    }
  }

  // Use the new calculation function
  const { barLeft, finalBarWidth, actualDuration } = calculateTaskPosition(
    currentStart,
    currentEnd,
    timeRange,
    viewMode
  );

  const priorityColors = getPriorityColors(task.priority || "low");

  const isOverdue = checkDateOverdue(currentEnd.toISOString()) && task.status.name.toLowerCase() !== "done";

  const isDone = task.status.name.toLowerCase() === "done";
  const isInProgress = task.status.name.toLowerCase().includes("progress");

  const handleNavigation = () => {
    // Don't navigate if we just finished resizing
    if (isResizing || justResized.current) return;

    const href =
      workspaceSlug && projectSlug
        ? `/${workspaceSlug}/${projectSlug}/tasks/${task.slug}`
        : workspaceSlug
          ? `/${workspaceSlug}/tasks/${task.slug}`
          : `/tasks/${task.slug}`;
    router.push(href);
  };

  const totalDays = timeRange.days.length;
  const cellWidth = getViewModeWidth(viewMode);

  return (
    <div
      className="relative flex-1 h-12"
      style={{
        minWidth: `${totalDays * cellWidth}px`,
      }}
      role="cell"
    >
      {/* Background Grid is now handled by GanttGrid layer at a higher level */}

      {/* Task Bar */}
      <div
        className={`absolute rounded-lg shadow-md border-2 cursor-pointer transition-colors group ${
          priorityColors.bg
        } ${priorityColors.border} ${isOverdue ? "border-red-500 animate-pulse" : ""}`}
        style={{
          left: `${barLeft}px`,
          width: `${finalBarWidth}px`,
          height: isCompact ? "20px" : "28px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: isResizing || isHovered ? 10 : 1
        }}
        title={`${task.title || "Untitled Task"}\nStatus: ${
          task.status.name
        }\nDuration: ${actualDuration} ${viewMode === "days" ? "days" : viewMode}`}
        tabIndex={0}
        role="button"
        ref={barRef}
        onMouseEnter={() => { updateTooltipSide(); onHover(task.id); }}
        onMouseLeave={() => onHover(null)}
        onKeyDown={(e) => onKeyDown(e, task)}
        onFocus={() => { updateTooltipSide(); onFocus(task.id); }}
        onBlur={() => onFocus(null)}
        onClick={handleNavigation}
        onMouseDown={(e) => handleInteractionStart(e, 'move')}
      >
        {/* Resize Handle Left */}
        {!isDone && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/10 hover:bg-black/20 z-20"
            onMouseDown={(e) => handleInteractionStart(e, 'left')}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <div className="h-full flex items-center justify-between px-2 text-white text-sm select-none">
          {finalBarWidth > 60 && !isCompact && (
            <span className={`text-xs font-medium truncate text-white`}>
              {task.title?.substring(0, Math.floor(finalBarWidth / 10))}
              {task.title && task.title.length > Math.floor(finalBarWidth / 10) ? "..." : ""}
            </span>
          )}

          {/* Icons */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Status icons */}
            {isDone && <HiCheckCircle className="w-4 h-4 text-white drop-shadow-sm" />}
            {isOverdue && !isDone && (
              <HiExclamationTriangle className="w-4 h-4 text-white drop-shadow-sm animate-pulse" />
            )}
            {isInProgress && <HiClock className="w-4 h-4 text-white drop-shadow-sm" />}
          </div>
        </div>

        {/* Resize Handle Right */}
        {!isDone && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/10 hover:bg-black/20 z-20"
            onMouseDown={(e) => handleInteractionStart(e, 'right')}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Hover Tooltip - show temp dates if resizing */}
        {(isHovered || isFocused || isResizing) && (
          <div className={`pointer-events-none absolute ${
            flipTooltipDown ? "top-full mt-2" : "bottom-full mb-2"
          } left-1/2 transform -translate-x-1/2 bg-[var(--popover)] text-[var(--popover-foreground)] px-3 py-2 rounded-lg shadow-lg z-40 whitespace-nowrap max-w-xs border border-[var(--border)] text-sm`}>
            <div className="font-semibold truncate text-sm">{task.title || "Untitled Task"}</div>
            <div className="text-[var(--muted-foreground)] mt-1 text-xs">
              {formatDateForDisplay(currentStart)} -{" "}
              {formatDateForDisplay(currentEnd)}
            </div>
            <div className="mt-2 text-sm">
              <StatusBadge status={task.status.name} />
            </div>
            <div className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent ${
              flipTooltipDown
                ? "bottom-full border-b-4 border-b-[var(--popover)]"
                : "top-full border-t-4 border-t-[var(--popover)]"
            }`}></div>
          </div>
        )}
      </div>
    </div>
  );
});

TaskBar.displayName = "TaskBar";
