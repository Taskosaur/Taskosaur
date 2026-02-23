import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Building2, FolderOpen, Users, CheckCircle, Bug, Zap, Clock } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"; // rectSortingStrategy belongs to @dnd-kit/sortable
import { rectSortingStrategy } from "@dnd-kit/sortable"; // Explicitly import rectSortingStrategy from @dnd-kit/sortable

import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";

interface OrganizationKPIMetricsProps {
  data: {
    totalWorkspaces: number;
    activeWorkspaces: number;
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalMembers: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalBugs: number;
    resolvedBugs: number;
    activeSprints: number;
    projectCompletionRate: number;
    taskCompletionRate: number;
    bugResolutionRate: number;
    overallProductivity: number;
  };
  visibleCards?: Array<{
    id: string;
    label: string;
    visible: boolean;
    isDefault: boolean;
    link?: string;
  }>;
  onOrderChange?: (newOrder: string[]) => void;
  taskStatuses?: any[];
}

interface KPICardConfig {
  id: string;
  defaultLabelKey: string; // Changed to key
  icon: React.ReactNode;
}

const STATIC_CARD_CONFIG: KPICardConfig[] = [
  { id: "workspaces", defaultLabelKey: "workspaces", icon: <Building2 className="h-4 w-4" /> },
  { id: "projects", defaultLabelKey: "projects", icon: <FolderOpen className="h-4 w-4" /> },
  { id: "members", defaultLabelKey: "members", icon: <Users className="h-4 w-4" /> },
  {
    id: "task-completion",
    defaultLabelKey: "task_completion",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  { id: "bug-resolution", defaultLabelKey: "bug_resolution", icon: <Bug className="h-4 w-4" /> },
  { id: "overdue-tasks", defaultLabelKey: "overdue_tasks", icon: <Clock className="h-4 w-4" /> },
  { id: "active-sprints", defaultLabelKey: "active_sprints", icon: <Zap className="h-4 w-4" /> },
  {
    id: "productivity",
    defaultLabelKey: "productivity",
    icon: <CheckCircle className="h-4 w-4" />,
  },
];

interface SortableStatCardProps {
  id: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  link?: string;
}

function SortableStatCard({ id, label, value, icon, description, link }: SortableStatCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
    touchAction: "none", // Prevent scrolling on touch devices while dragging
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only navigate if we're not dragging and we have a link
    if (!isDragging && link) {
      router.push(link);
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={handleClick}>
      <StatCard label={label} value={value} icon={icon} description={description} className={link ? "cursor-pointer" : ""} />
    </div>
  );
}

export function OrganizationKPIMetrics({
  data,
  visibleCards = [],
  onOrderChange,
  taskStatuses = [],
}: OrganizationKPIMetricsProps) {
  const { t } = useTranslation("workspace-home");
  // Initialize orderedIds based on visibleCards prop or default static config
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    if (visibleCards.length > 0) {
      return visibleCards.filter((card) => card.visible).map((card) => card.id);
    }
    return ["workspaces", "projects", "members", "task-completion"];
  });

  // Compute done status IDs from task statuses
  const doneStatusIds = useMemo(() => {
    if (!taskStatuses || taskStatuses.length === 0) return "";
    return taskStatuses
      .filter((s) => s.category === "DONE")
      .map((s) => s.id)
      .join(",");
  }, [taskStatuses]);

  // Sync state if visibleCards prop changes order or visibility externally
  useEffect(() => {
    if (visibleCards.length > 0) {
      const visibleIds = visibleCards.filter((c) => c.visible).map((c) => c.id);
      // Only update if the order or content is actually different to avoid loop
      if (JSON.stringify(visibleIds) !== JSON.stringify(orderedIds)) {
        setOrderedIds(visibleIds);
      }
    }
  }, [visibleCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requires 8px movement before drag starts (prevents accidental clicks)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedIds.indexOf(active.id as string);
      const newIndex = orderedIds.indexOf(over.id as string);
      const newOrder = arrayMove(orderedIds, oldIndex, newIndex);

      setOrderedIds(newOrder);

      if (onOrderChange) {
        onOrderChange(newOrder);
      }
    }
  };

  // Merge static config, dynamic data, and visibility/order
  const displayCards = useMemo(() => {
    return orderedIds
      .map((id) => {
        const config = STATIC_CARD_CONFIG.find((c) => c.id === id);
        if (!config) return null;

        // Dynamic data mapping
        let value: string | number = 0;
        let description = "";
        let icon = config.icon; // Default icon

        switch (id) {
          case "workspaces":
            value = data?.totalWorkspaces ?? 0;
            description = t("analytics.kpi_cards.descriptions.active_status", { count: data?.activeWorkspaces ?? 0 });
            break;
          case "projects":
            value = data?.totalProjects ?? 0;
            description = t("analytics.kpi_cards.descriptions.active_status", { count: data?.activeProjects ?? 0 });
            break;
          case "members":
            value = data?.totalMembers ?? 0;
            description = t("analytics.kpi_cards.descriptions.organization_members");
            break;
          case "task-completion":
            value = `${(data?.taskCompletionRate ?? 0).toFixed(1)}%`;
            description = t("analytics.kpi_cards.descriptions.tasks_count", { completed: data?.completedTasks ?? 0, total: data?.totalTasks ?? 0 });
            break;
          case "bug-resolution":
            value = `${(data?.bugResolutionRate ?? 0).toFixed(1)}%`;
            description = t("analytics.kpi_cards.descriptions.resolved_count", { resolved: data?.resolvedBugs ?? 0, total: data?.totalBugs ?? 0 });
            break;
          case "overdue-tasks":
            value = data?.overdueTasks ?? 0;
            description = t("analytics.kpi_cards.descriptions.require_attention");
            // Conditional icon for overdue tasks
            if (data?.overdueTasks === 0) {
              icon = <CheckCircle className="h-4 w-4" />;
            } else {
              icon = <Clock className="h-4 w-4" />;
            }
            break;
          case "active-sprints":
            value = data?.activeSprints ?? 0;
            description = t("analytics.kpi_cards.descriptions.currently_running");
            break;
          case "productivity":
            value = `${data?.overallProductivity?.toFixed(1) || 0}%`;
            description = t("analytics.kpi_cards.descriptions.task_completion_rate");
            break;
          default:
            break;
        }

        return {
          id,
          label: t(`analytics.kpi_cards.${config.defaultLabelKey}`),
          value,
          description,
          icon,
          link: id === "task-completion" && doneStatusIds
            ? `/tasks?statuses=${doneStatusIds}&types=TASK`
            : id === "bug-resolution" && doneStatusIds
            ? `/tasks?statuses=${doneStatusIds}&types=BUG`
            : visibleCards.find((c) => c.id === id)?.link,
        };
      })
      .filter((card): card is NonNullable<typeof card> => card !== null);
  }, [orderedIds, data, t, doneStatusIds, visibleCards]);

  const visibleCount = displayCards.length;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div
          className={`grid gap-4 ${
            visibleCount <= 4
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
              : visibleCount <= 6
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
          }`}
        >
          {displayCards.map((card) => (
            <SortableStatCard
              key={card.id}
              id={card.id}
              label={card.label}
              value={card.value}
              icon={card.icon}
              description={card.description}
              link={card.link}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
