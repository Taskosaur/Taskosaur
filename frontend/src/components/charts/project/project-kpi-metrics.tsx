import { StatCard } from "@/components/common/StatCard";
import { CheckCircle, AlertTriangle, TrendingUp, Bug, Zap, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
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

interface ProjectKPIMetricsProps {
  data: {
    totalTasks: number;
    completedTasks: number;
    activeSprints: number;
    totalBugs: number;
    resolvedBugs: number;
    completionRate: number;
    bugResolutionRate: number;
  };
  taskStatus?: any[];
}

interface SortableStatCardProps {
  id: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  onClick?: () => void;
}

function SortableStatCard({ id, label, value, icon, description, onClick }: SortableStatCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "pointer",
    touchAction: "none",
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={(e) => {
        // Only trigger onClick if we're not dragging
        if (!isDragging && onClick) {
          onClick();
        }
      }}
    >
      <StatCard 
        label={label} 
        value={value} 
        icon={icon} 
        className={`transition-colors hover:bg-[var(--accent)]/50`}
      />
    </div>
  );
}

export function ProjectKPIMetrics({ data, taskStatus }: ProjectKPIMetricsProps) {
  const { t } = useTranslation(["analytics"]);
  const router = useRouter();

  const { workspaceSlug, projectSlug } = router.query;

  const [orderedIds, setOrderedIds] = useState<string[]>([
    "total-tasks",
    "completed-tasks",
    "active-sprints",
    "bug-resolution",
    "task-completion",
    "open-bugs",
  ]);

  const doneStatusIds = useMemo(() => {
    if (!taskStatus) return "";
    return taskStatus
      .filter((s) => s.status?.category === "DONE")
      .map((s) => s.statusId)
      .join(",");
  }, [taskStatus]);

  const openStatusIds = useMemo(() => {
    if (!taskStatus) return "";
    return taskStatus
      .filter((s) => s.status?.category !== "DONE")
      .map((s) => s.statusId)
      .join(",");
  }, [taskStatus]);

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

  const handleNavigate = (path: string, query?: Record<string, string>) => {
    if (!workspaceSlug || !projectSlug) return;
    
    router.push({
      pathname: `/${workspaceSlug}/${projectSlug}${path}`,
      query,
    });
  };

  const displayCards = useMemo(() => {
    return orderedIds.map((id) => {
      switch (id) {
        case "total-tasks":
          return {
            id,
            title: t("kpi.total_tasks.title"),
            label: t("kpi.total_tasks.label"),
            value: data?.totalTasks,
            description: t("kpi.total_tasks.description"),
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: () => handleNavigate("/tasks"),
          };
        case "completed-tasks":
          return {
            id,
            title: t("kpi.completed_tasks.title"),
            label: t("kpi.completed_tasks.label"),
            value: data?.completedTasks,
            description: t("kpi.completed_tasks.description"),
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: () => handleNavigate("/tasks", doneStatusIds ? { statuses: doneStatusIds } : {}),
          };
        case "active-sprints":
          return {
            id,
            title: t("kpi.active_sprints.title"),
            label: t("kpi.active_sprints.label"),
            value: data?.activeSprints,
            description: t("kpi.active_sprints.description"),
            icon: <Zap className="h-4 w-4" />,
            onClick: () => handleNavigate("/sprints"),
          };
        case "bug-resolution":
          return {
            id,
            title: t("kpi.bug_resolution.title"),
            label: t("kpi.bug_resolution.label"),
            value: `${data?.bugResolutionRate.toFixed(1)}%`,
            description: t("kpi.bug_resolution.description", {
              resolved: data?.resolvedBugs,
              total: data?.totalBugs,
            }),
            icon: <Bug className="h-4 w-4" />,
            onClick: () => handleNavigate("/tasks",  doneStatusIds ? { statuses: doneStatusIds, types: "BUG" } : {}),
          };
        case "task-completion":
          return {
            id,
            title: t("kpi.task_completion.title"),
            label: t("kpi.task_completion.label"),
            value: `${data?.completionRate.toFixed(1)}%`,
            description: t("kpi.task_completion.description"),
            icon:
              data?.completionRate > 75 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              ),
            onClick: () => handleNavigate("/tasks", doneStatusIds ? { statuses: doneStatusIds } : {}),
          };
        case "open-bugs":
          return {
            id,
            title: t("kpi.open_bugs.title"),
            label: t("kpi.open_bugs.label"),
            value: data?.totalBugs - data?.resolvedBugs,
            description: t("kpi.open_bugs.description"),
            icon:
              data?.totalBugs - data?.resolvedBugs === 0 ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <Bug className="h-4 w-4" />
              ),
            onClick: () => handleNavigate("/tasks", openStatusIds ? { types: "BUG", statuses: openStatusIds } : {} ),
          };
        default:
          return null;
      }
    }).filter((c): c is NonNullable<typeof c> => c !== null);
  }, [orderedIds, data, workspaceSlug, projectSlug, doneStatusIds]);


  if (!router.isReady) {
    return null;
  }


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
              description={card.description}
              onClick={card.onClick}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
