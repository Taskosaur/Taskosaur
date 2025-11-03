import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Activity, BarChart3, CheckSquare, RefreshCw } from "lucide-react";
import ActionButton from "./ActionButton";

interface SettingsItem {
  id: string;
  label: string;
  visible: boolean;
  isDefault?: boolean;
}

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  items: SettingsItem[];
  onToggleItem: (itemId: string) => void;
  onShowAll: () => void;
  onReset: () => void;
}

interface DashboardSettingsDropdownProps {
  sections?: SettingsSection[];
  triggerClassName?: string;
  dropdownWidth?: string;
  title?: string;
  description?: string;
}

export function DashboardSettingsDropdown({
  sections = [],
  triggerClassName = "border-none bg-[var(--accent)]",
  dropdownWidth = "w-96",
  title = "Dashboard Settings",
  description = "Customize your dashboard widgets and metrics",
}: DashboardSettingsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton variant="default" className={triggerClassName}>
          <Settings className="h-4 w-4" />
        </ActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`${dropdownWidth} p-0 bg-[var(--card)] border-none max-h-[80vh] overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--muted)] p-4 border-none">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--primary)]" />
            <h3 className="font-semibold text-[var(--card-foreground)]">{title}</h3>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>
        </div>

        {/* Content */}
        <div className="p-3 overflow-y-auto flex-1">
          {sections.map((section, sectionIndex) => {
            const IconComponent = section.icon;
            const allVisible = section.items.every((item) => item.visible);

            return (
              <div key={section.id}>
                {/* Section Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-[var(--primary)]" />
                      <DropdownMenuLabel className="p-0 font-medium text-[var(--card-foreground)]">
                        {section.title}
                      </DropdownMenuLabel>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (allVisible) {
                          section.onReset();
                        } else {
                          section.onShowAll();
                        }
                      }}
                      className="h-6 w-6 p-0 hover:bg-[var(--accent)]"
                    >
                      {allVisible ? (
                        <RefreshCw className="h-3 w-3 text-[var(--muted-foreground)]" />
                      ) : (
                        <CheckSquare className="h-3 w-3 text-[var(--primary)]" />
                      )}
                    </Button>
                  </div>

                  {/* Section Items */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--accent)] cursor-pointer group"
                        onClick={() => section.onToggleItem(item.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox checked={item.visible} />
                          <span
                            className={`text-sm ${
                              item.visible
                                ? "text-[var(--card-foreground)] font-medium"
                                : "text-[var(--muted-foreground)]"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Separator between sections */}
                {sectionIndex < sections.length - 1 && (
                  <DropdownMenuSeparator className="my-3 bg-[var(--border)]" />
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {sections.length === 0 && (
            <div className="text-center py-6 text-[var(--muted-foreground)]">
              <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No settings available</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Convenience hook for creating sections
export function useDashboardSettings() {
  const createKPISection = (
    kpiCards: any[],
    toggleKPICard: (id: string) => void,
    showAllKPICards: () => void,
    resetKPICards: () => void
  ): SettingsSection => ({
    id: "kpi-metrics",
    title: "KPI Metrics",
    icon: Activity,
    items: kpiCards.map((card) => ({
      id: card.id,
      label: card.label,
      visible: card.visible,
      isDefault: card.isDefault,
    })),
    onToggleItem: toggleKPICard,
    onShowAll: showAllKPICards,
    onReset: resetKPICards,
  });

  const createWidgetsSection = (
    widgets: any[],
    toggleWidget: (id: string) => void,
    resetWidgets: () => void,
    resetToDefaults: () => void
  ): SettingsSection => ({
    id: "chart-widgets",
    title: "Chart Widgets",
    icon: BarChart3,
    items: widgets.map((widget) => ({
      id: widget.id,
      label: widget.title,
      visible: widget.visible,
    })),
    onToggleItem: toggleWidget,
    onShowAll: resetWidgets,
    onReset: resetToDefaults,
  });

  return {
    createKPISection,
    createWidgetsSection,
  };
}
