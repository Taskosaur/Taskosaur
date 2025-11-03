"use client";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { ColumnConfig } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { HiOutlineCog } from "react-icons/hi2";
import { AVAILABLE_COLUMN_TYPES } from "@/utils/taskColumnList";
import { HiCheckCircle } from "react-icons/hi";
import { CalendarDays } from "lucide-react";
import Tooltip from "../common/ToolTip";

interface ColumnManagerProps {
  availableColumns: ColumnConfig[];
  onAddColumn: (columnId: string) => void;
  onRemoveColumn: (columnId: string) => void;
  currentView?: "list" | "kanban" | "gantt";
  setKabBanSettingModal?: (open: boolean) => void;
  onResetColumns?: () => void;
}

export function ColumnManager({
  availableColumns,
  onAddColumn,
  onRemoveColumn,
  currentView = "list",
  setKabBanSettingModal,
  onResetColumns,
}: ColumnManagerProps) {
  const visibleColumnIds = availableColumns.map((col) => col.id);

  const handleButtonClick = () => {
    if (currentView === "kanban" && setKabBanSettingModal) {
      setKabBanSettingModal(true);
    }
  };

  if (currentView === "kanban") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-[var(--border)] cursor-pointer flex items-center gap-2"
        onClick={handleButtonClick}
      >
        <HiOutlineCog size={14} />
      </Button>
    );
  }

  // List view
  return (
    <DropdownMenu>
      <Tooltip content="Manage Columns" position="top" color="primary">
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-[var(--border)] cursor-pointer flex items-center gap-2"
          >
            <HiOutlineCog size={14} />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64 bg-[var(--card)] border-[var(--border)]">
        <DropdownMenuLabel className="text-xs font-semibold  flex justify-between items-center">
          <span>Manage View Columns</span>
          {onResetColumns && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onResetColumns();
              }}
            >
              <RotateCcw size={12} />
              Reset
            </Button>
          )}
        </DropdownMenuLabel>
        <div className="px-2 py-1 text-xs text-muted-foreground">
          Customize which columns are visible in your view
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto">
          {AVAILABLE_COLUMN_TYPES.map((column) => {
            let Icon = column.icon;
            // Use CalendarDays for any calendar/date columns
            if (
              column.id === "dueDate" ||
              column.id === "timeline" ||
              column.id === "date" ||
              column.id === "completedAt"
            ) {
              Icon = CalendarDays;
            }
            const isActive = visibleColumnIds.includes(column.id);

            return (
              <DropdownMenuItem
                key={column.id}
                onClick={(e) => {
                  e.preventDefault();
                  isActive ? onRemoveColumn(column.id) : onAddColumn(column.id);
                }}
                className={`my-1 cursor-pointer justify-between py-2 ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] text-sx"
                    : "hover:bg-[var(--accent)]/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{column.label}</span>
                  </div>
                </div>
                {isActive && (
                  <HiCheckCircle className="w-4 h-4 text-[var(--primary)] animate-in zoom-in-50 duration-200" />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
