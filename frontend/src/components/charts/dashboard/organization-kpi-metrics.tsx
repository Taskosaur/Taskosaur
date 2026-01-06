import { useState, useEffect, useMemo } from "react";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  }>;
  onOrderChange?: (newOrder: string[]) => void;
}

interface KPICardConfig {
  id: string;
  defaultLabel: string;
  icon: React.ReactNode;
}

const STATIC_CARD_CONFIG: KPICardConfig[] = [
  { id: "workspaces", defaultLabel: "Total Workspaces", icon: <Building2 className="h-4 w-4" /> },
  { id: "projects", defaultLabel: "Total Projects", icon: <FolderOpen className="h-4 w-4" /> },
  { id: "members", defaultLabel: "Team Members", icon: <Users className="h-4 w-4" /> },
  {
    id: "task-completion",
    defaultLabel: "Task Completion",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  { id: "bug-resolution", defaultLabel: "Bug Resolution", icon: <Bug className="h-4 w-4" /> },
  { id: "overdue-tasks", defaultLabel: "Overdue Tasks", icon: <Clock className="h-4 w-4" /> },
  { id: "active-sprints", defaultLabel: "Active Sprints", icon: <Zap className="h-4 w-4" /> },
  {
    id: "productivity",
    defaultLabel: "Overall Productivity",
    icon: <CheckCircle className="h-4 w-4" />,
  },
];

interface SortableStatCardProps {
  id: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function SortableStatCard({ id, label, value, icon, description }: SortableStatCardProps) {
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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StatCard label={label} value={value} icon={icon} />
    </div>
  );
}

export function OrganizationKPIMetrics({
  data,
  visibleCards = [],
  onOrderChange,
}: OrganizationKPIMetricsProps) {
  // Initialize orderedIds based on visibleCards prop or default static config
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    if (visibleCards.length > 0) {
      return visibleCards.filter((c) => c.visible).map((c) => c.id);
    }
    return STATIC_CARD_CONFIG.map((c) => c.id); // Default to all
  });

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
            description = `${data?.activeWorkspaces ?? 0} active`;
            break;
          case "projects":
            value = data?.totalProjects ?? 0;
            description = `${data?.activeProjects ?? 0} active`;
            break;
          case "members":
            value = data?.totalMembers ?? 0;
            description = "Organization members";
            break;
          case "task-completion":
            value = `${(data?.taskCompletionRate ?? 0).toFixed(1)}%`;
            description = `${data?.completedTasks ?? 0}/${data?.totalTasks ?? 0} tasks`;
            break;
          case "bug-resolution":
            value = `${(data?.bugResolutionRate ?? 0).toFixed(1)}%`;
            description = `${data?.resolvedBugs ?? 0}/${data?.totalBugs ?? 0} resolved`;
            break;
          case "overdue-tasks":
            value = data?.overdueTasks ?? 0;
            description = "Require attention";
            // Conditional icon for overdue tasks
            if (data?.overdueTasks === 0) {
              icon = <CheckCircle className="h-4 w-4" />;
            } else {
              icon = <Clock className="h-4 w-4" />;
            }
            break;
          case "active-sprints":
            value = data?.activeSprints ?? 0;
            description = "Currently running";
            break;
          case "productivity":
            value = `${data?.overallProductivity?.toFixed(1) || 0}%`;
            description = "Task completion rate";
            break;
          default:
            break;
        }

        return {
          id,
          label: config.defaultLabel,
          value,
          description,
          icon,
        };
      })
      .filter((card): card is NonNullable<typeof card> => card !== null);
  }, [orderedIds, data]);

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
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}