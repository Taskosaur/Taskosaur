import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { HiCheckCircle } from "react-icons/hi2";

import { DEFAULT_SORT_FIELDS } from "@/utils/data/taskData";
import Tooltip from "../common/ToolTip";
export type SortOrder = "asc" | "desc";
export type SortField = string;

interface SortFieldConfig {
  value: string;
  label: string;
  icon: React.ComponentType<any>;
  category: "date" | "text" | "number" | "user";
}

interface SortingManagerProps {
  sortField: SortField;
  sortOrder: SortOrder;
  onSortFieldChange: (field: SortField) => void;
  onSortOrderChange: (order: SortOrder) => void;
  onResetSort?: () => void;
  availableFields?: SortFieldConfig[];
}

const SortingManager: React.FC<SortingManagerProps> = ({
  sortField,
  sortOrder,
  onSortFieldChange,
  onSortOrderChange,
  onResetSort,
  availableFields = DEFAULT_SORT_FIELDS,
}) => {
  const groupedFields = availableFields.reduce(
    (acc, field) => {
      const validCategories = ["date", "text", "number", "user"] as const;
      const category: "date" | "text" | "number" | "user" = validCategories.includes(
        field.category as any
      )
        ? (field.category as "date" | "text" | "number" | "user")
        : "text";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(field as SortFieldConfig);
      return acc;
    },
    {} as Record<"date" | "text" | "number" | "user", SortFieldConfig[]>
  );

  const handleSortOrderToggle = () => {
    onSortOrderChange(sortOrder === "asc" ? "desc" : "asc");
  };

  const handleFieldSelect = (field: SortFieldConfig) => {
    onSortFieldChange(field.value);
  };

  const handleReset = () => {
    if (onResetSort) {
      onResetSort();
    } else {
      onSortFieldChange("createdAt");
      onSortOrderChange("desc");
    }
  };

  return (
    <DropdownMenu>
      <Tooltip content="Sort tasks" position="top" color="primary">
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-[var(--border)] cursor-pointer flex items-center gap-2 min-w-[40px]"
          >
            <ArrowUpDown className="!w-[15px] !h-[15px] text-[var(--foreground)]" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-64 bg-[var(--card)] border-[var(--border)]">
        <DropdownMenuLabel className="text-xs font-semibold flex justify-between items-center">
          <span>Sort Options</span>
          <Tooltip content="Reset" position="top" color="primary">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
            >
              <RotateCcw size={12} />
            </Button>
          </Tooltip>
        </DropdownMenuLabel>
        <div className="px-2  text-xs text-[var(--muted-foreground)]">
          Choose how to sort your tasks
        </div>
        <DropdownMenuSeparator />
        {/* Sort Direction Controls */}
        <div className="px-2">
          <div className="text-xs font-medium text-[var(--foreground)] mb-2">Direction</div>
          <div className="flex gap-1">
            <Button
              variant={sortOrder === "asc" ? "default" : "outline"}
              size="sm"
              className={`flex-1 text-xs h-8 ${
                sortOrder === "asc"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)]"
              }`}
              onClick={handleSortOrderToggle}
            >
              <ArrowUp size={12} className="mr-1" />
              Ascending
            </Button>
            <Button
              variant={sortOrder === "desc" ? "default" : "outline"}
              size="sm"
              className={`flex-1 text-xs h-8 ${
                sortOrder === "desc"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)]"
              }`}
              onClick={handleSortOrderToggle}
            >
              <ArrowDown size={12} className="mr-1" />
              Descending
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {/* Sort Fields */}
        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
          {Object.entries(groupedFields).map(([category, fields], idx) => (
            <div key={category}>
              {fields.map((field) => {
                const Icon = field.icon;
                const isActive = sortField === field.value;
                return (
                  <DropdownMenuItem
                    key={field.value}
                    onClick={(e) => {
                      e.preventDefault();
                      handleFieldSelect(field);
                    }}
                    className={`my-1 cursor-pointer justify-between py-2 text-xs ${
                      isActive
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--accent)]/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-muted-foreground">{field.label}</span>
                    </div>
                    {isActive && (
                      <HiCheckCircle className="w-4 h-4 text-[var(--primary)] animate-in zoom-in-50 duration-200" />
                    )}
                  </DropdownMenuItem>
                );
              })}
              {/* Only show separator between categories, not after the last one */}
              {idx < Object.entries(groupedFields).length - 1 && (
                <DropdownMenuSeparator className="my-1" />
              )}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SortingManager;
