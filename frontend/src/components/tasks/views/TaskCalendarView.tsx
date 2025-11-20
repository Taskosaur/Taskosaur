import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { HiChevronLeft, HiChevronRight, HiCalendarDays } from "react-icons/hi2";
import { HiX } from "react-icons/hi";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { StatusBadge } from "@/components/ui";
import { PriorityBadge } from "@/components/ui";
import MDEditor from "@uiw/react-md-editor";
import validator from "validator";

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  createdAt?: string;
  priority?: string;
  status?: {
    name: string;
  };
  assignee?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

interface TaskCalendarViewProps {
  tasks: Task[];
  workspaceSlug: string;
  projectSlug?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfMonth: number;
  tasks: Task[];
}

interface WeekDay extends CalendarDay {
  hours: { hour: number; tasks: Task[] }[];
}

export default function TaskCalendarView({
  tasks = [],
  workspaceSlug,
  projectSlug,
}: TaskCalendarViewProps) {
  const filteredTasks = Array.isArray(tasks) ? tasks : [];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const router = useRouter();

  const getStatusColors = (statusName: string): string => {
    switch (statusName?.toLowerCase()) {
      case "done":
      case "completed":
        return "bg-[var(--foreground)] text-[var(--background)]";
      case "in progress":
      case "in_progress":
        return "bg-[var(--muted)] text-[var(--foreground)]";
      case "review":
        return "bg-[var(--accent)] text-[var(--accent-foreground)]";
      default:
        return "bg-[var(--muted)] text-[var(--muted-foreground)]";
    }
  };

  const parseDate = (dateString: string | undefined): Date | null => {
    if (!dateString) return null;
    return new Date(dateString);
  };

  // Helper function to validate internal paths and prevent open redirect vulnerabilities
  const isValidInternalPath = (path: string): boolean => {
    if (!path || typeof path !== 'string') return false;
    // Ensure the path starts with / and doesn't contain protocol or domain
    if (!path.startsWith('/')) return false;
    if (path.includes('://') || path.startsWith('//')) return false;
    return true;
  };

  // Helper function to sanitize slug inputs before URL construction
  const sanitizeSlug = (slug: string | string[] | undefined): string => {
    if (!slug || typeof slug !== 'string') return '';
    // Allow alphanumeric, dash, underscore, and dot
    if (!/^[a-zA-Z0-9._-]+$/.test(slug)) return '';
    return slug;
  };

  const getTaskUrl = (taskId: string) => {
    // Validate taskId as UUID before URL construction
    if (!validator.isUUID(taskId, 4)) {
      console.error('Invalid task ID format:', taskId);
      return '';
    }

    const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
    const safeProjectSlug = sanitizeSlug(projectSlug);

    if (safeWorkspaceSlug && safeProjectSlug) {
      return `/${safeWorkspaceSlug}/${safeProjectSlug}/tasks/${taskId}`;
    } else if (safeWorkspaceSlug) {
      return `/${safeWorkspaceSlug}/tasks/${taskId}`;
    } else {
      return `/tasks/${taskId}`;
    }
  };

  const currentMonth = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(currentDate);
  }, [currentDate]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfCalendar = new Date(firstDayOfMonth);
    const dayOfWeek = firstDayOfMonth.getDay();
    firstDayOfCalendar.setDate(firstDayOfCalendar.getDate() - dayOfWeek);

    const lastDayOfCalendar = new Date(lastDayOfMonth);
    const remainingDays = 6 - lastDayOfMonth.getDay();
    lastDayOfCalendar.setDate(lastDayOfCalendar.getDate() + remainingDays);

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDay = new Date(firstDayOfCalendar);
    while (currentDay <= lastDayOfCalendar) {
      const currentDayDate = new Date(currentDay);
      const isCurrentMonth = currentDayDate.getMonth() === month;
      const isToday = currentDayDate.getTime() === today.getTime();

      const dayTasks = filteredTasks?.filter((task) => {
        const dueDate = parseDate(task.dueDate);
        if (!dueDate) return false;
        return (
          dueDate.getFullYear() === currentDayDate.getFullYear() &&
          dueDate.getMonth() === currentDayDate.getMonth() &&
          dueDate.getDate() === currentDayDate.getDate()
        );
      });

      days.push({
        date: new Date(currentDayDate),
        isCurrentMonth,
        isToday,
        dayOfMonth: currentDayDate.getDate(),
        tasks: dayTasks,
      });

      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  }, [currentDate, filteredTasks]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    const days: WeekDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);

      const isToday = currentDay.getTime() === today.getTime();

      const dayTasks = filteredTasks.filter((task) => {
        const dueDate = parseDate(task.dueDate);
        if (!dueDate) return false;
        return (
          dueDate.getFullYear() === currentDay.getFullYear() &&
          dueDate.getMonth() === currentDay.getMonth() &&
          dueDate.getDate() === currentDay.getDate()
        );
      });

      // Create hour slots for week view
      const hours = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        tasks: dayTasks.filter(() => Math.random() > 0.8), // Random distribution for demo
      }));

      days.push({
        date: new Date(currentDay),
        isCurrentMonth: true,
        isToday,
        dayOfMonth: currentDay.getDate(),
        tasks: dayTasks,
        hours,
      });
    }

    return days;
  }, [currentDate, filteredTasks]);

  const navigate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
    } else {
      if (direction === "prev") {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() + 7);
      }
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  if (tasks?.length === 0) {
    return (
      <div className="w-full bg-[var(--card)] rounded-[var(--radius)] shadow-sm p-4">
        <div className="text-center py-8 flex flex-col items-center justify-center">
          <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center mx-auto mb-3">
            <HiCalendarDays className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">No tasks scheduled</p>
          <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">
            Tasks with due dates will appear on the calendar. Create tasks with specific due dates
            to visualize your schedule.
          </p>
        </div>
      </div>
    );
  }

  const renderMonthView = () => (
    <>
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="py-2 text-center font-semibold text-xs text-[var(--muted-foreground)] border-r border-[var(--border)] last:border-r-0 bg-[var(--muted)]/10"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const isSelected = selectedDay && day.date.toDateString() === selectedDay.toDateString();

          return (
            <div
              key={index}
              className={`min-h-[100px] p-2 transition-all duration-200 cursor-pointer bg-[var(--card)] border-r border-b border-[var(--border)] last:border-r-0 hover:bg-[var(--accent)] ${
                day.isToday ? "ring-1 ring-inset ring-[var(--primary)]" : ""
              } ${
                isSelected ? "bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]" : ""
              } ${!day.isCurrentMonth ? "opacity-40" : ""}`}
              onClick={() => setSelectedDay(day.date)}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold ${
                    day.isToday ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                  }`}
                >
                  {day.dayOfMonth}
                </span>
                {day.tasks.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                    <span className="text-xs font-medium text-[var(--muted-foreground)]">
                      {day.tasks.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Task List */}
              <div className="space-y-1">
                {day.tasks.slice(0, 2).map((task) => {
                  const statusColors = getStatusColors(task.status?.name || "");
                  const isOverdue =
                    new Date(task.dueDate!) < new Date() &&
                    task.status?.name?.toLowerCase() !== "done";

                  return (
                    <div
                      key={task.id}
                      className={`block p-1 rounded-md transition-all duration-200 hover:shadow-sm group text-xs cursor-pointer ${
                        isOverdue
                          ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                          : statusColors
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const taskUrl = getTaskUrl(task.id);
                        if (isValidInternalPath(taskUrl)) {
                          router.push(taskUrl);
                        } else {
                          router.push('/');
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-medium truncate flex-1">
                          {task.title || "Untitled Task"}
                        </p>
                        {task.assignee && <UserAvatar user={task.assignee} size="xs" />}
                      </div>
                    </div>
                  );
                })}

                {day.tasks.length > 2 && (
                  <div className="text-xs text-[var(--muted-foreground)] text-center py-1">
                    +{day.tasks.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderWeekView = () => (
    <div className="flex flex-col">
      {/* Week Header */}
      <div className="flex border-b border-[var(--border)] bg-[var(--muted)]/10 sticky top-0 z-10">
        <div className="w-20 flex-shrink-0 py-2 px-2 text-center font-semibold text-xs text-[var(--muted-foreground)] border-r border-[var(--border)]">
          Time
        </div>
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day, index) => (
            <div
              key={day.date.toISOString()}
              className={`py-2 px-2 text-center border-r border-[var(--border)] last:border-r-0 ${
                day.isToday ? "bg-[var(--primary)]/5" : ""
              }`}
            >
              <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                {day.date.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={`text-sm font-bold mt-1 ${
                  day.isToday ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                }`}
              >
                {day.dayOfMonth}
              </div>
              {day.tasks.length > 0 && (
                <div className="flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                  <span className="text-xs font-medium text-[var(--muted-foreground)] ml-1">
                    {day.tasks.length}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>{" "}
      {/* Week Grid - Time Slots */}
      <div className="overflow-y-auto max-h-[500px]">
        <div className="flex">
          {/* Time column */}
          <div className="w-20 flex-shrink-0 bg-[var(--muted)]/5">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="h-16 px-2 py-2 text-xs text-[var(--muted-foreground)] flex items-start justify-end border-b border-r border-[var(--border)]"
              >
                <span className="font-medium">
                  {hour === 0
                    ? "12 AM"
                    : hour === 12
                      ? "12 PM"
                      : hour < 12
                        ? `${hour} AM`
                        : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns container */}
          <div className="flex-1 grid grid-cols-7">
            {weekDays.map((day, dayIndex) => (
              <div key={day.date.toISOString()} className="bg-[var(--card)] relative">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className={`h-16 hover:bg-[var(--accent)] transition-colors border-b border-r border-[var(--border)] last:border-r-0 cursor-pointer relative ${
                      day.isToday ? "bg-[var(--primary)]/2" : ""
                    }`}
                    title={`${day.date.toLocaleDateString()} ${
                      hour === 0
                        ? "12 AM"
                        : hour === 12
                          ? "12 PM"
                          : hour < 12
                            ? `${hour} AM`
                            : `${hour - 12} PM`
                    }`}
                  >
                    {/* Tasks for this time slot */}
                    {day.tasks
                      .filter(() => Math.random() > 0.85 && hour >= 8 && hour <= 18) // Show tasks during work hours
                      .slice(0, 1)
                      .map((task, taskIndex) => (
                        <div
                          key={task.id}
                          className="absolute inset-x-1 top-1 bottom-1 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-sm px-2 py-1 text-xs font-medium hover:bg-[var(--primary)]/90 hover:shadow-sm transition-all duration-200 truncate z-10 flex items-center group cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const taskUrl = getTaskUrl(task.id);
                            if (isValidInternalPath(taskUrl)) {
                              router.push(taskUrl);
                            } else {
                              router.push('/');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1 w-full">
                            <span className="truncate flex-1">{task.title}</span>
                            {task.assignee && <UserAvatar user={task.assignee} size="xs" />}
                          </div>
                        </div>
                      ))}

                    {/* Current time indicator */}
                    {day.isToday &&
                      (() => {
                        const now = new Date();
                        const currentHour = now.getHours();
                        const currentMinute = now.getMinutes();
                        if (hour === currentHour) {
                          return (
                            <div
                              className="absolute left-0 right-0 h-0.5 bg-red-500 z-20"
                              style={{ top: `${(currentMinute / 60) * 100}%` }}
                            >
                              <div className="absolute left-0 w-2 h-2 bg-red-500 rounded-full -translate-y-1/2 -translate-x-0"></div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full rounded-[var(--radius)] h-full overflow-hidden">
      {/* Calendar Header */}
      <div className=" bg-[var(--muted)]/20 ">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-md font-semibold text-[var(--foreground)] mb-1 flex items-center gap-1">
              <HiCalendarDays className="w-4 h-4 text-[var(--muted-foreground)]" />
              {viewMode === "month"
                ? currentMonth
                : `Week of ${weekDays[0]?.date.toLocaleDateString()}`}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {viewMode === "month"
                ? `${
                    calendarDays.filter((day) => day.isCurrentMonth && day.tasks.length > 0).length
                  } days with tasks this month`
                : `${weekDays.reduce((sum, day) => sum + day.tasks.length, 0)} tasks this week`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[var(--muted)]/50 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("month")}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                  viewMode === "month"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                  viewMode === "week"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Week
              </button>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("prev")}
                className="h-7 w-7 p-0 bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)]"
              >
                <HiChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="h-7 px-2 text-xs font-medium bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)]"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("next")}
                className="h-7 w-7 p-0 bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)]"
              >
                <HiChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="bg-[var(--card)] cursor-pointer">
        {viewMode === "month" ? renderMonthView() : renderWeekView()}
      </div>

      {/* Task Details Sidebar (Month view only, when day is selected) */}
      {selectedDay && viewMode === "month" && (
        <div className="bg-[var(--muted)]/10 p-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-[var(--foreground)]">
              {selectedDay.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDay(null)}
              className="h-7 w-7 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
            >
              <HiX className="w-4 h-4" />
            </Button>
          </div>

          {(() => {
            const dayTasks =
              calendarDays.find((day) => day.date.toDateString() === selectedDay.toDateString())
                ?.tasks || [];

            if (dayTasks.length === 0) {
              return (
                <div className="text-center py-4">
                  <HiCalendarDays className="w-6 h-6 mx-auto mb-1 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">No tasks scheduled for this day</p>
                </div>
              );
            }

            return (
              <div className="space-y-1">
                {dayTasks.map((task) => {
                  const isOverdue =
                    new Date(task.dueDate!) < new Date() &&
                    task.status?.name?.toLowerCase() !== "done";

                  return (
                    <div
                      key={task.id}
                      className={`block py-3 px-4 rounded-md transition-all duration-200 hover:shadow-sm group cursor-pointer bg-[var(--mini-sidebar)] capitalize ${
                        isOverdue
                          ? " text-red-800  dark:text-red-300"
                          : " text-foreground  dark:text-foreground"
                      }`}
                      onClick={() => {
                        const taskUrl = getTaskUrl(task.id);
                        if (isValidInternalPath(taskUrl)) {
                          router.push(taskUrl);
                        } else {
                          router.push('/');
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 ">
                        <div className="flex-1">
                          <h5 className="font-semibold text-xs mb-1 text-[var(--foreground)]">
                            {task.title || "Untitled Task"}
                          </h5>
                          <div className="flex items-center gap-1 mb-1">
                            <StatusBadge status={task.status?.name || "No Status"} />
                            {task.priority && <PriorityBadge priority={task.priority} />}
                            {isOverdue && (
                              <span className="inline-block text-xs px-1.5 py-0 h-4 rounded bg-red-500 text-white dark:bg-red-700 dark:text-white">
                                Overdue
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <div className="text-xs text-[var(--muted-foreground)] line-clamp-1">
                              {task.description}
                            </div>
                          )}
                        </div>
                        {task.assignee && (
                          <div className="flex items-center gap-1">
                            <UserAvatar user={task.assignee} size="xs" />
                            <div className="text-right">
                              <p className="text-xs font-medium text-foreground">
                                {task.assignee.firstName} {task.assignee.lastName}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Assignee</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
