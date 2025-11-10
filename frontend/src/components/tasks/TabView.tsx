import React, { ReactNode } from "react";
import { HiListBullet, HiViewColumns, HiCalendarDays } from "react-icons/hi2";
import { cn } from "@/lib/utils";

interface TaskViewTabsProps {
  currentView: "list" | "kanban" | "gantt";
  onViewChange: (view: "list" | "kanban" | "gantt") => void;
  viewKanban?: boolean;
  viewGantt?: boolean;
  rightContent?: ReactNode;
}

export default function TabView({
  currentView,
  onViewChange,
  viewKanban = false,
  viewGantt = true,
  rightContent,
}: TaskViewTabsProps) {
  const tabs = [
    { id: "list" as const, label: "List", icon: HiListBullet },
    ...(viewKanban ? [{ id: "kanban" as const, label: "Kanban", icon: HiViewColumns }] : []),
    ...(viewGantt ? [{ id: "gantt" as const, label: "Gantt", icon: HiCalendarDays }] : []),
  ];

  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]">
      <nav className="flex space-x-6" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-1 py-2 text-sm font-medium relative transition-colors cursor-pointer",
                isActive
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon size={16} />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--primary)]" />
              )}
            </button>
          );
        })}
      </nav>

      {rightContent && <div className="flex items-center">{rightContent}</div>}
    </div>
  );
}
