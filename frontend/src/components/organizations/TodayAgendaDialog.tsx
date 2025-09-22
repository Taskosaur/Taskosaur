import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, Sparkles } from "lucide-react";
import { Task } from "@/types";

interface TodayAgendaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  upcomingTasks?: Task[];
}

const getPriorityConfig = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case "HIGH":
    case "URGENT":
      return {
        color: "bg-[var(--destructive)]",
        bgClass:
          "bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)]/20",
        iconClass: "text-[var(--destructive)]",
        label: "High Priority",
      };
    case "MEDIUM":
      return {
        color: "bg-amber-500",
        bgClass:
          "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
        iconClass: "text-amber-500",
        label: "Medium Priority",
      };
    case "LOW":
      return {
        color: "bg-green-500",
        bgClass:
          "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
        iconClass: "text-green-500",
        label: "Low Priority",
      };
    default:
      return {
        color: "bg-[var(--muted)]",
        bgClass:
          "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]",
        iconClass: "text-[var(--muted-foreground)]",
        label: "Normal",
      };
  }
};

const formatDueDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));

    if (diffHours < 0) return "Overdue";
    if (diffHours < 24) return `${diffHours}h left`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

export function TodayAgendaDialog({
  isOpen,
  onClose,
  currentDate,
  upcomingTasks = [],
}: TodayAgendaDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[var(--card)] border-[var(--border)]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[var(--primary-foreground)]" />
                </div>
                {upcomingTasks.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {upcomingTasks.length}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
                  Today&apos;s Agenda
                  <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--muted-foreground)]">
                  {currentDate}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <CardContent className="p-0 max-h-[50vh] overflow-y-auto">
          <div className="p-4 space-y-3">
            {upcomingTasks.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <div className="space-y-2">
                    {upcomingTasks.map((task) => {
                      const priorityConfig = getPriorityConfig(task.priority);
                      const isUrgent = task.priority === "HIGH";
                      return (
                        <div
                          key={task.id}
                          className={`group p-3 rounded-lg border transition-all duration-200 ${
                            isUrgent
                              ? "border-red-200 bg-red-50/30 dark:border-red-800/30 dark:bg-red-900/5 hover:bg-red-50 dark:hover:bg-red-900/10"
                              : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)]/30 hover:border-[var(--primary)]/20"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${priorityConfig.color} flex-shrink-0`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate ">
                                    {task.title}
                                  </p>
                                  {task.description && (
                                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Badge
                                    className={`text-[10px] px-1.5 py-0.5 ${priorityConfig.bgClass} border-none`}
                                  >
                                    {task.priority}
                                  </Badge>
                                </div>
                              </div>
                              {task.dueDate && (
                                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[var(--muted-foreground)]">
                                  <Clock className="w-2.5 h-2.5" />
                                  Due: {formatDueDate(task.dueDate)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <h4 className="text-base font-semibold text-[var(--foreground)] mb-1">
                  All clear for today!
                </h4>
                <p className="text-sm text-[var(--muted-foreground)] mb-3 max-w-xs mx-auto">
                  No tasks scheduled. You&apos;re all caught up!
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <Sparkles className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    Great job staying organized!
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </DialogContent>
    </Dialog>
  );
}
