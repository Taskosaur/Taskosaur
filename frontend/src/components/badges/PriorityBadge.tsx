import type React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const getPriorityConfig = (priority: string) => {
    const normalizedPriority = String(priority || "low").toLowerCase();

    switch (normalizedPriority) {
      case "highest":
        return {
          color: "#dc2626",
          label: "Highest",
        };
      case "high":
        return {
          color: "#ea580c",
          label: "High",
        };
      case "medium":
        return {
          color: "#d97706",
          label: "Medium",
        };
      case "low":
        return {
          color: "#16a34a",
          label: "Low",
        };
      default:
        return {
          color: "#6b7280",
          label: "No Priority",
        };
    }
  };

  const config = getPriorityConfig(priority);

  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 w-20 py-1 text-[13px] font-medium rounded-full border-0 shadow-sm text-white",
        className
      )}
      style={{
        backgroundColor: config.color,
      }}
    >
      <span>{config.label}</span>
    </Badge>
  );
};

export { PriorityBadge };
