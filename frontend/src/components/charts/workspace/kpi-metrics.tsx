// components/charts/workspace/kpi-metrics.tsx
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/router";
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

interface KPIMetricsProps {
  data: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  workspaceId?: string;
}

interface SortableStatCardProps {
  id: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
  statSuffix?: React.ReactNode;
  onClick?: () => void;
}

function SortableStatCard({ id, label, value, icon, statSuffix, onClick }: SortableStatCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : (onClick ? "pointer" : "default"),
    touchAction: "none",
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={(e) => {
        if (!isDragging && onClick) {
          onClick();
        }
      }}
    >
      <StatCard
        label={label}
        value={value}
        icon={icon}
        statSuffix={statSuffix}
        className="transition-colors hover:bg-[var(--accent)]/50"
      />
    </div>
  );
}

export function KPIMetrics({ data, workspaceId }: KPIMetricsProps) {
  console.log("KPIMetrics data:", data);
  const router = useRouter();
  const { workspaceSlug } = router.query;

  const handleNavigate = (path: string, query?: Record<string, string>) => {
    if (!workspaceSlug) return;
    router.push({
      pathname: `/${workspaceSlug}${path}`,
      query,
    });
  };

  const [orderedIds, setOrderedIds] = useState<string[]>([
    "total-projects",
    "active-projects",
    "completion-rate",
    "total-tasks",
    "overdue-tasks",
    "task-health",
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const displayCards = useMemo(() => {
    return orderedIds.map((id) => {
      switch (id) {
        case "total-projects":
          return {
            id,
            label: "Total Projects",
            value: data?.totalProjects,
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: () => handleNavigate("/projects"),
          };
        case "active-projects":
          return {
            id,
            label: "Active Projects",
            value: data?.activeProjects,
            icon: <TrendingUp className="h-4 w-4" />,
            statSuffix:
              data?.totalProjects > 0
                ? `${((data?.activeProjects / data?.totalProjects) * 100).toFixed(1)}%`
                : "0%",
            onClick: () => handleNavigate("/projects", { statuses: "ACTIVE" }),
          };
        case "completion-rate":
          return {
            id,
            label: "Completion Rate",
            value: `${data?.completionRate?.toFixed(1) || 0}%`,
            icon:
              data?.completionRate > 70 ? (
                <TrendingUp className="h-4 w-4 " />
              ) : (
                <TrendingDown className="h-4 w-4" />
              ),
            statSuffix: (
              <Badge
                variant={
                  data?.completionRate > 70
                    ? "default"
                    : data?.completionRate > 50
                      ? "secondary"
                      : "destructive"
                }
                className="text-xs"
              >
                {data?.completionRate > 70
                  ? "Excellent"
                  : data?.completionRate > 50
                    ? "Good"
                    : "Needs Focus"}
              </Badge>
            ),
            onClick: () => handleNavigate("/projects", { statuses: "COMPLETED" }),
          };
        case "total-tasks":
          return {
            id,
            label: "Total Tasks",
            value: data?.totalTasks,
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: () => handleNavigate("/tasks"),
          };
        case "overdue-tasks":
          return {
            id,
            label: "Overdue Tasks",
            value: data?.overdueTasks,
            icon:
              data?.overdueTasks > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              ),
            statSuffix: (
              <Badge variant={data?.overdueTasks === 0 ? "default" : "outline"} className="text-xs">
                {data?.overdueTasks === 0 ? "Perfect" : data?.overdueTasks < 10 ? "Good" : "Critical"}
              </Badge>
            ),
            onClick: () => handleNavigate("/tasks"),
          };
        case "task-health":
          return {
            id,
            label: "Task Health",
            value:
              data?.totalTasks > 0
                ? `${(((data?.totalTasks - data?.overdueTasks) / data?.totalTasks) * 100).toFixed(1)}%`
                : "0%",
            icon:
              data?.overdueTasks === 0 ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              ),
            statSuffix: (
              <Badge variant={data?.overdueTasks === 0 ? "default" : "outline"} className="text-xs">
                {data?.overdueTasks === 0 ? "Perfect" : "Monitor"}
              </Badge>
            ),
            // Removed onClick: () => handleNavigate("/tasks"),
          };
        default:
          return null;
      }
    }).filter((c): c is NonNullable<typeof c> => c !== null);
  }, [orderedIds, data, workspaceSlug]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {displayCards.map((card) => (
            <SortableStatCard
              key={card.id}
              id={card.id}
              label={card.label}
              value={card.value}
              icon={card.icon}
              statSuffix={card.statSuffix}
              onClick={card.onClick}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
