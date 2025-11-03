import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/badges/PriorityBadge";
import { HiPlus, HiCalendar } from "react-icons/hi";
import { useAuth } from "@/contexts/auth-context";

interface SimpleTask {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  startDate: string;
  dueDate: string;
  projectId: string;
  assigneeId?: string;
  reporterId?: string;
  statusId: string;
}

interface TaskStatus {
  id: string;
  name: string;
  color?: string;
  order?: number;
}

interface ProjectKanbanViewProps {
  tasks: SimpleTask[];
  taskStatuses: TaskStatus[];
  workspaceSlug: string;
  projectSlug: string;
  className?: string;
}

interface SimpleTaskCardProps {
  task: SimpleTask;
  workspaceSlug: string;
  projectSlug: string;
}

const SimpleTaskCard: React.FC<SimpleTaskCardProps> = ({ task, workspaceSlug, projectSlug }) => {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Link
      href={`/${workspaceSlug}/${projectSlug}/tasks/${task.id}`}
      className="projects-task-card-link"
    >
      <Card className="projects-task-card">
        <CardHeader className="projects-task-card-header">
          <CardTitle>
            <span className="projects-task-card-title">{task.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="projects-task-card-content">
          <div className="projects-task-card-meta">
            <PriorityBadge priority={task.priority} />
          </div>
          {task.dueDate && (
            <div className="projects-task-card-due-date">
              <HiCalendar size={10} />
              Due: {formatDate(task.dueDate)}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

interface KanbanColumnProps {
  statusName: string;
  tasks: SimpleTask[];
  workspaceSlug: string;
  projectSlug: string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  statusName,
  tasks,
  workspaceSlug,
  projectSlug,
}) => {
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!projectSlug) return;
    getUserAccess({ name: "project", id: projectSlug })
      .then((data) => {
        setHasAccess(data?.canChange);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [projectSlug]);

  return (
    <Card className="projects-kanban-column">
      <CardHeader className="projects-kanban-column-header">
        <div className="projects-kanban-column-header-content">
          <CardTitle>
            <span className="projects-kanban-column-title">{statusName}</span>
          </CardTitle>
          <span className="projects-kanban-column-count">{tasks.length}</span>
        </div>
      </CardHeader>
      <CardContent className="projects-kanban-column-content">
        <div className="projects-kanban-tasks">
          {tasks.map((task) => (
            <SimpleTaskCard
              key={task.id}
              task={task}
              workspaceSlug={workspaceSlug}
              projectSlug={projectSlug}
            />
          ))}
          {tasks.length === 0 && <div className="projects-kanban-empty">No tasks</div>}

          {hasAccess && (
            <Link
              href={`/${workspaceSlug}/${projectSlug}/tasks/new?status=${statusName}`}
              className="projects-kanban-add-task"
            >
              <HiPlus size={12} className="projects-kanban-add-task-icon" />
              Add task
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const ProjectKanbanView: React.FC<ProjectKanbanViewProps> = ({
  tasks,
  taskStatuses,
  workspaceSlug,
  projectSlug,
  className,
}) => {
  // Group tasks by status
  const tasksByStatus: Record<string, SimpleTask[]> = {};

  taskStatuses.forEach((status) => {
    tasksByStatus[status.name] = [];
  });

  // Fallback statuses if none are provided
  if (taskStatuses.length === 0) {
    tasksByStatus["To Do"] = [];
    tasksByStatus["In Progress"] = [];
    tasksByStatus["Review"] = [];
    tasksByStatus["Done"] = [];
  }

  tasks.forEach((task) => {
    const status = taskStatuses.find((s) => s.id === task.statusId);
    const statusName = status?.name || "To Do";
    if (tasksByStatus[statusName]) {
      tasksByStatus[statusName].push(task);
    }
  });

  return (
    <div className={`projects-kanban-grid ${className || ""}`}>
      {Object.entries(tasksByStatus).map(([statusName, statusTasks]) => (
        <KanbanColumn
          key={statusName}
          statusName={statusName}
          tasks={statusTasks}
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
        />
      ))}
    </div>
  );
};
