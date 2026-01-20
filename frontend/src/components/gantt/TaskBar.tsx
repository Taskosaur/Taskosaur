import { Task } from "@/types";
import { TimeRange, ViewMode } from "@/types";
import {
  calculateTaskPosition,
  getPriorityColors,
  getViewModeWidth,
  isWeekend,
  parseDate,
} from "@/utils/gantt";
import { useRouter } from "next/router";
import { type KeyboardEvent, useState, useEffect, useRef } from "react";
import { StatusBadge } from "../ui";
import { HiCheckCircle, HiClock } from "react-icons/hi";
import { HiExclamationTriangle } from "react-icons/hi2";

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
export const TaskBar: React.FC<TaskBarProps> = ({
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
  
  // State for resizing
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'left' | 'right' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialStart, setInitialStart] = useState<Date | null>(null);
  const [initialEnd, setInitialEnd] = useState<Date | null>(null);
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempEnd, setTempEnd] = useState<Date | null>(null);
  const justResized = useRef(false);

  const taskStart = parseDate(task.startDate);
  const taskEnd = parseDate(task.dueDate);

  // Resize Handlers
  const handleResizeStart = (e: React.MouseEvent, direction: 'left' | 'right') => {
    e.stopPropagation(); // Prevent navigation click
    e.preventDefault();
    setIsResizing(true);
    justResized.current = false;
    setResizeDirection(direction);
    setDragStartX(e.clientX);
    setInitialStart(taskStart);
    setInitialEnd(taskEnd);
    setTempStart(taskStart);
    setTempEnd(taskEnd);
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
      
      if (resizeDirection === 'left') {
        if (initialStart && initialEnd) {
          const newStart = new Date(initialStart);
          newStart.setDate(newStart.getDate() + deltaDaysCalc);
          // Limit: start cannot be after end (minus 1 day for minimum duration)
          const maxStart = new Date(initialEnd);
          maxStart.setDate(maxStart.getDate() - 1);
          
          if (newStart < maxStart) {
            setTempStart(newStart);
          } else {
            setTempStart(maxStart);
          }
        }
      } else {
        if (initialEnd && initialStart) {
          const newEnd = new Date(initialEnd);
          newEnd.setDate(newEnd.getDate() + deltaDaysCalc);
          // Limit: end cannot be before start (plus 1 day)
          const minEnd = new Date(initialStart);
          minEnd.setDate(minEnd.getDate() + 1);
          
          if (newEnd > minEnd) {
            setTempEnd(newEnd);
          } else {
            setTempEnd(minEnd);
          }
        }
      }
    };

    const handleMouseUp = async () => {
      setIsResizing(false);
      setResizeDirection(null);
      
      // Only update if dates actually changed
      const currentStart = tempStart || taskStart;
      const currentEnd = tempEnd || taskEnd;
      
      const hasChanged = 
        currentStart.getTime() !== taskStart.getTime() || 
        currentEnd.getTime() !== taskEnd.getTime();

      if (onTaskUpdate && hasChanged) {
        await onTaskUpdate(task.id, {
          startDate: currentStart.toISOString(),
          dueDate: currentEnd.toISOString()
        });
      }
      // Reset temp states after update
      setTempStart(null);
      setTempEnd(null);
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
  }, [isResizing, dragStartX, initialStart, initialEnd, viewMode, onTaskUpdate, task.id, resizeDirection, taskStart, taskEnd, tempStart, tempEnd]);

  // Use temp dates if resizing
  const currentStart = isResizing && tempStart ? tempStart : taskStart;
  const currentEnd = isResizing && tempEnd ? tempEnd : taskEnd;

  // Use the new calculation function
  const { barLeft, finalBarWidth, actualDuration } = calculateTaskPosition(
    currentStart,
    currentEnd,
    timeRange,
    viewMode
  );

  const priorityColors = getPriorityColors(task.priority || "low");

  const isOverdue = currentEnd < new Date() && task.status.name.toLowerCase() !== "done";

  const isDone = task.status.name.toLowerCase() === "done";
  const isInProgress = task.status.name.toLowerCase().includes("progress");

  const handleNavigation = () => {
    // Don't navigate if we just finished resizing
    if (isResizing || justResized.current) return;
    
    const href =
      workspaceSlug && projectSlug
        ? `/${workspaceSlug}/${projectSlug}/tasks/${task.id}`
        : workspaceSlug
          ? `/${workspaceSlug}/tasks/${task.id}`
          : `/tasks/${task.id}`;
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
      {/* Background Grid */}
      <div className="absolute inset-0 flex">
        {timeRange.days.map((day, index) => {
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div
              key={index}
              className={`border-r border-[var(--border)] shrink-0 ${
                isWeekend(day) && viewMode === "days"
                  ? "bg-[var(--muted)]"
                  : isToday
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
                    : "hover:bg-[var(--accent)]"
              }`}
              style={{ width: `${cellWidth}px` }}
            >
              {isToday && (
                <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-600 dark:border-blue-400"></div>
              )}
            </div>
          );
        })}
      </div>

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
        onMouseEnter={() => onHover(task.id)}
        onMouseLeave={() => onHover(null)}
        onKeyDown={(e) => onKeyDown(e, task)}
        onFocus={() => onFocus(task.id)}
        onBlur={() => onFocus(null)}
        onClick={handleNavigation}
      >
        {/* Resize Handle Left */}
        {!isDone && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/10 hover:bg-black/20 z-20"
            onMouseDown={(e) => handleResizeStart(e, 'left')}
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
            onMouseDown={(e) => handleResizeStart(e, 'right')}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Hover Tooltip - show temp dates if resizing */}
        {(isHovered || isFocused || isResizing) && (
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-[var(--popover)] text-[var(--popover-foreground)] px-3 py-2 rounded-lg shadow-lg z-40 whitespace-nowrap max-w-xs border border-[var(--border)] text-sm">
            <div className="font-semibold truncate text-sm">{task.title || "Untitled Task"}</div>
            <div className="text-[var(--muted-foreground)] mt-1 text-xs">
              {currentStart.toLocaleDateString()} -{" "}
              {currentEnd.toLocaleDateString()}
            </div>
            <div className="mt-2 text-sm">
              <StatusBadge status={task.status.name} />
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--popover)]"></div>
          </div>
        )}
      </div>
    </div>
  );
};
