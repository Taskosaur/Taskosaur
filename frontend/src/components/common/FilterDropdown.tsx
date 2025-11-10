import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Filter,
  Search,
  X,
  CheckSquare,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";

// Status color mapping to match StatusBadge component
const getStatusColor = (statusName: string): string => {
  const normalizedStatus = statusName.toLowerCase().replace(/\s+/g, "-");

  const statusColorMap: Record<string, string> = {
    todo: "#374151", // gray-700
    backlog: "#374151", // gray-700
    "in-progress": "#2563eb", // blue-600
    active: "#2563eb", // blue-600
    "in-review": "#9333ea", // purple-600
    completed: "#16a34a", // green-600
    done: "#16a34a", // green-600
    cancelled: "#dc2626", // red-600
    "on-hold": "#374151", // gray-700
    planning: "#374151", // gray-700
  };

  return statusColorMap[normalizedStatus] || "#6b7280"; // default gray-500
};

interface FilterItem {
  id: string;
  label: string;
  value: string;
  selected: boolean;
  count?: number;
  color?: string;
  description?: string;
}

interface FilterSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  items: FilterItem[];
  searchable?: boolean;
  multiSelect?: boolean;
  allowSelectAll?: boolean;
  allowClearAll?: boolean;
  onToggleItem: (itemId: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  onSearch?: (query: string) => void;
  disabled?: boolean;
}

interface FilterDropdownProps {
  sections?: FilterSection[];
  triggerClassName?: string;
  dropdownWidth?: string;
  title?: string;
  description?: string | null;
  activeFiltersCount?: number;
  onClearAllFilters?: () => void;
  onApplyFilters?: () => void;
  showApplyButton?: boolean;
  placeholder?: string;
  maxHeight?: string;
  showCounts?: boolean;
  onOpen?: () => void;
}

export function FilterDropdown({
  sections = [],
  triggerClassName = "border-0 bg-[var(--accent)] hover:bg-[var(--accent)]/80",
  dropdownWidth = "w-80",
  title = "Filters",
  description = null,
  activeFiltersCount = 0,
  onClearAllFilters,
  onApplyFilters,
  showApplyButton = false,
  maxHeight = "85vh",
  showCounts = false,
  onOpen,
}: FilterDropdownProps) {
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initialExpanded: Record<string, boolean> = {};
    sections.forEach((section) => {
      const hasSelectedItems = section.items.some((item) => item.selected);
      initialExpanded[section.id] = hasSelectedItems;
    });
    return initialExpanded;
  });

  useEffect(() => {
    const newExpanded: Record<string, boolean> = {};
    sections.forEach((section) => {
      const hasSelectedItems = section.items.some((item) => item.selected);
      newExpanded[section.id] = hasSelectedItems || expandedSections[section.id];
    });
    setExpandedSections(newExpanded);
  }, [sections]);

  const handleSectionSearch = (sectionId: string, query: string) => {
    setSearchQueries((prev) => ({
      ...prev,
      [sectionId]: query,
    }));

    const section = sections.find((s) => s.id === sectionId);
    if (section?.onSearch) {
      section.onSearch(query);
    }
  };

  const clearSectionSearch = (sectionId: string) => {
    setSearchQueries((prev) => ({
      ...prev,
      [sectionId]: "",
    }));

    const section = sections.find((s) => s.id === sectionId);
    if (section?.onSearch) {
      section.onSearch("");
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleItemToggle = (section: FilterSection, itemId: string) => {
    try {
      if (!section.multiSelect) {
        section.items.forEach((item) => {
          if (item.selected && item.id !== itemId) {
            section.onToggleItem(item.id);
          }
        });
      }
      section.onToggleItem(itemId);
    } catch (error) {
      console.error("Error toggling filter item:", error);
    }
  };

  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && onOpen) {
      onOpen();
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`relative ${triggerClassName} transition-all duration-200 h-9`}
        >
          <SlidersHorizontal className="h-5 w-5" />

          {showCounts && activeFiltersCount > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-[var(--accent-foreground)] text-[var(--accent)] text-xs border-2 border-white rounded-full"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={`${dropdownWidth} p-0 bg-[var(--card)] border border-[var(--border)] shadow-xl overflow-hidden flex flex-col rounded-lg`}
        style={{ maxHeight: maxHeight }}
        sideOffset={4}
      >
        <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--muted)] p-2.5 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-[var(--primary)]" />
              <h3 className="font-medium text-sm text-[var(--card-foreground)]">{title}</h3>
            </div>

            {onClearAllFilters && activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAllFilters}
                className="h-5 px-1.5 text-xs hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>

          {description && (
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{description}</p>
          )}
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {sections.map((section) => {
            const IconComponent = section.icon;
            const selectedItems = section.items.filter((item) => item.selected);
            const searchQuery = searchQueries[section.id] || "";
            const filteredItems = searchQuery
              ? section.items.filter(
                  (item) =>
                    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
                )
              : section.items;

            const isExpanded = expandedSections[section.id];

            return (
              <div
                key={section.id}
                className={`border-b border-[var(--border)] last:border-b-0 ${section.disabled ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div
                  className="flex items-center justify-between px-2.5 py-2 cursor-pointer hover:bg-[var(--accent)]/50 transition-colors"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <IconComponent className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <DropdownMenuLabel className="p-0 font-medium text-[var(--card-foreground)] text-xs cursor-pointer">
                      {section.title}
                    </DropdownMenuLabel>
                    {showCounts && selectedItems.length > 0 && (
                      <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                        {selectedItems.length}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {section.allowSelectAll && section.onSelectAll && section.multiSelect && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const allSelected =
                            section.items.length > 0 &&
                            section.items.every((item) => item.selected);
                          allSelected ? section.onClearAll?.() : section.onSelectAll();
                        }}
                        className="h-6 w-6 p-0 hover:bg-[var(--accent)]"
                        title={
                          section.items.length > 0 && section.items.every((item) => item.selected)
                            ? "Deselect All"
                            : "Select All"
                        }
                      >
                        {section.items.length > 0 &&
                        section.items.every((item) => item.selected) ? (
                          <CheckSquare className="h-3 w-3 text-[var(--muted-foreground)] hover:text-[var(--primary)]" />
                        ) : (
                          <Square className="h-3 w-3 text-[var(--muted-foreground)] hover:text-[var(--primary)]" />
                        )}
                      </Button>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-2.5 pb-2.5">
                    {section.searchable && (
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-[var(--muted-foreground)]" />
                        <Input
                          placeholder={`Search ${section.title.toLowerCase()}...`}
                          value={searchQuery}
                          onChange={(e) => handleSectionSearch(section.id, e.target.value)}
                          className="pl-7 pr-7 h-7 text-xs border-[var(--border)] bg-[var(--background)]"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearSectionSearch(section.id)}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-[var(--accent)]"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                      {filteredItems.length > 0 ? (
                        filteredItems.map((item) => {
                          // Use StatusBadge colors for status-related sections
                          const itemColor =
                            section.id === "status" || section.title.toLowerCase() === "status"
                              ? getStatusColor(item.label)
                              : item.color;

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-1.5 rounded-md hover:bg-[var(--accent)] transition-all duration-200 cursor-pointer group border border-transparent hover:border-[var(--border)] hover:shadow-sm"
                              onClick={() => handleItemToggle(section, item.id)}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {/* Always use Checkbox for both multiSelect and singleSelect */}
                                <Checkbox checked={item.selected} className="h-3.5 w-3.5" />

                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  {itemColor && (
                                    <div
                                      className="w-3 h-3 rounded-full border border-[var(--border)] flex-shrink-0"
                                      style={{ backgroundColor: itemColor }}
                                    />
                                  )}

                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span
                                      className={`text-sm transition-colors duration-200 truncate ${
                                        item.selected
                                          ? "text-[var(--card-foreground)] font-medium"
                                          : "text-[var(--muted-foreground)]"
                                      }`}
                                      title={item.label}
                                    >
                                      {item.label}
                                    </span>
                                    {item.description && (
                                      <span className="text-xs text-[var(--muted-foreground)] truncate">
                                        {item.description}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {showCounts && item.count !== undefined && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-[var(--muted)] border-[var(--border)] ml-auto flex-shrink-0"
                                  >
                                    {item.count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-[var(--muted-foreground)]">
                          <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">No items found</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sections.length === 0 && (
            <div className="text-center py-12 px-4 text-[var(--muted-foreground)]">
              <Filter className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No filters available</p>
              <p className="text-xs">Add filter sections to get started</p>
            </div>
          )}
        </div>

        {showApplyButton && onApplyFilters && (
          <div className="p-2.5 border-t border-[var(--border)] bg-[var(--muted)]/30 flex-shrink-0">
            <Button
              onClick={onApplyFilters}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] h-7 text-xs"
              size="sm"
            >
              Apply Filters
              {activeFiltersCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 bg-white/20 text-white border-white/20 h-4 text-[10px] px-1.5"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function createFilterSection({
  id,
  title,
  icon,
  items,
  searchable = false,
  multiSelect = true,
  allowSelectAll = true,
  allowClearAll = true,
  onToggleItem,
  onSelectAll,
  onClearAll,
  onSearch,
  disabled = false,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  items: FilterItem[];
  searchable?: boolean;
  multiSelect?: boolean;
  allowSelectAll?: boolean;
  allowClearAll?: boolean;
  onToggleItem: (itemId: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  onSearch?: (query: string) => void;
  disabled?: boolean;
}): FilterSection {
  return {
    id,
    title,
    icon,
    items,
    searchable,
    multiSelect,
    allowSelectAll,
    allowClearAll,
    onToggleItem,
    onSelectAll,
    onClearAll,
    onSearch,
    disabled,
  };
}

export function useGenericFilters() {
  const createSection = (config: {
    id: string;
    title: string;
    icon: React.ComponentType<any>;
    data: any[];
    selectedIds: string[];
    searchable?: boolean;
    multiSelect?: boolean;
    allowSelectAll?: boolean;
    allowClearAll?: boolean;
    onToggle: (id: string) => void;
    onSelectAll?: () => void;
    onClearAll?: () => void;
    onSearch?: (query: string) => void;
    mapDataToItem?: (item: any) => FilterItem;
    disabled?: boolean;
  }): FilterSection => {
    const defaultMapDataToItem = (item: any): FilterItem => ({
      id: item.id || item.value,
      label: item.name || item.label || item.title,
      value: item.value || item.id,
      selected: config.selectedIds.includes(item.id || item.value),
      count: item.count,
      color: item.color,
      description: item.description,
    });

    return createFilterSection({
      id: config.id,
      title: config.title,
      icon: config.icon,
      items: config.data.map(config.mapDataToItem || defaultMapDataToItem),
      searchable: config.searchable,
      multiSelect: config.multiSelect,
      allowSelectAll: config.allowSelectAll && config.multiSelect,
      allowClearAll: config.allowClearAll,
      onToggleItem: config.onToggle,
      onSelectAll: config.onSelectAll,
      onClearAll: config.onClearAll,
      onSearch: config.onSearch,
      disabled: config.disabled,
    });
  };

  return { createSection };
}
