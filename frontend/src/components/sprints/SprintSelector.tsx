import React from "react";
import { Sprint } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { HiPlay, HiClock, HiCheck, HiChevronDown, HiCalendar } from "react-icons/hi2";
import { HiLightningBolt } from "react-icons/hi";
import { Button } from "@/components/ui/button";
interface SprintSelectorProps {
  currentSprint: Sprint | null;
  sprints: Sprint[];
  onSprintChange: (sprint: Sprint) => void;
}

const getSprintStatusConfig = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return {
        className: "sprints-status-active sprints-status-active-dark",
        icon: HiPlay,
        color: "sprints-stats-icon-green sprints-stats-icon-green-dark",
      };
    case "PLANNED":
      return {
        className: "sprints-status-planned sprints-status-planned-dark",
        icon: HiClock,
        color: "sprints-stats-icon-blue sprints-stats-icon-blue-dark",
      };
    case "COMPLETED":
      return {
        className: "sprints-status-completed sprints-status-completed-dark",
        icon: HiCheck,
        color: "text-gray-600 dark:text-gray-400",
      };
    default:
      return {
        className: "sprints-status-default",
        icon: HiClock,
        color: "text-[var(--muted-foreground)]",
      };
  }
};

export default function SprintSelector({
  currentSprint,
  sprints,
  onSprintChange,
}: SprintSelectorProps) {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  const currentSprintConfig = currentSprint ? getSprintStatusConfig(currentSprint.status) : null;
  const CurrentIcon = currentSprintConfig?.icon || HiClock;

  return (
    <div className="sprints-selector-container">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="sprints-selector-trigger" aria-haspopup="true">
            <div
              className={`sprints-selector-icon-container ${currentSprint ? "sprints-selector-icon-active" : "sprints-selector-icon-inactive"}`}
            >
              <CurrentIcon
                className={`sprints-selector-icon ${currentSprintConfig?.color || "text-[var(--muted-foreground)]"}`}
              />
            </div>
            <div className="sprints-selector-content">
              <div className="sprints-selector-name">
                {currentSprint?.name || "No Active Sprint"}
              </div>
            </div>
            <HiChevronDown className="sprints-selector-chevron" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="sprints-selector-dropdown" align="start" sideOffset={8}>
          {sprints.length === 0 ? (
            <div className="sprints-selector-empty">
              <div className="sprints-selector-empty-icon-container">
                <HiLightningBolt className="sprints-selector-empty-icon" />
              </div>
              <p className="sprints-selector-empty-title">No sprints available</p>
              <p className="sprints-selector-empty-subtitle">Create your first sprint</p>
            </div>
          ) : (
            <div className="sprints-selector-list">
              {sprints.map((sprint) => {
                const sprintConfig = getSprintStatusConfig(sprint.status);
                const SprintIcon = sprintConfig.icon;
                const isSelected = currentSprint?.id === sprint.id;

                return (
                  <DropdownMenuItem
                    key={sprint.id}
                    className="sprints-selector-item"
                    onClick={() => onSprintChange(sprint)}
                  >
                    <div
                      className={`sprints-selector-item-content ${
                        isSelected
                          ? "sprints-selector-item-selected"
                          : "sprints-selector-item-unselected"
                      }`}
                    >
                      <div className="sprints-selector-item-header">
                        <div
                          className={`sprints-selector-item-icon-container ${
                            isSelected
                              ? "sprints-selector-item-icon-selected"
                              : "sprints-selector-item-icon-unselected"
                          }`}
                        >
                          <SprintIcon className={`w-3 h-3 ${sprintConfig.color}`} />
                        </div>
                        <div className="sprints-selector-item-details">
                          <div className="sprints-selector-item-title-row">
                            <span className="sprints-selector-item-name">{sprint.name}</span>
                            {isSelected && (
                              <div className="sprints-selector-check-container">
                                <HiCheck className="sprints-selector-check-icon" />
                              </div>
                            )}
                          </div>
                          <div className="sprints-selector-item-meta">
                            <Badge
                              className={`sprints-selector-item-badge ${sprintConfig.className}`}
                            >
                              {sprint.status}
                            </Badge>
                            <span className="sprints-selector-item-dates">
                              <HiCalendar className="sprints-selector-item-dates-icon" />
                              {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {sprint.goal && (
                        <div className="sprints-selector-item-goal">{sprint.goal}</div>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
