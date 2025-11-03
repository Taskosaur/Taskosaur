import React, { useState, useEffect } from "react";
import { Task, Sprint, TaskPriority, TaskType } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import {
  HiPlay,
  HiBookmark,
  HiClock,
  HiCalendar,
  HiFlag,
  HiPlus,
  HiClipboardDocumentList,
  HiChartBar,
  HiUsers,
  HiDocumentText,
  HiPencilSquare,
} from "react-icons/hi2";
import { HiBugAnt } from "react-icons/hi2";
import { FiTarget } from "react-icons/fi";
interface SprintPlanningProps {
  projectId: string;
  sprintId?: string | null;
  onSprintUpdate?: (sprint: Sprint) => void;
}

const LoadingSkeleton = () => (
  <div className="sprints-loading-container">
    <div className="sprints-loading-skeleton">
      <div className="sprints-loading-title"></div>
      <div className="sprints-loading-subtitle"></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="sprints-loading-column">
            <div className="sprints-loading-column-title"></div>
            <div className="sprints-loading-tasks">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-24 bg-[var(--muted)] rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const getPriorityConfig = (priority: TaskPriority) => {
  switch (priority) {
    case "HIGHEST":
      return {
        className: "sprints-priority-highest sprints-priority-highest-dark",
      };
    case "HIGH":
      return { className: "sprints-priority-high sprints-priority-high-dark" };
    case "MEDIUM":
      return {
        className: "sprints-priority-medium sprints-priority-medium-dark",
      };
    case "LOW":
      return { className: "sprints-priority-low sprints-priority-low-dark" };
    case "LOWEST":
      return {
        className: "sprints-priority-lowest sprints-priority-lowest-dark",
      };
    default:
      return { className: "sprints-priority-default" };
  }
};

export default function SprintPlanning({ projectId, sprintId }: SprintPlanningProps) {
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [sprintTasks, setSprintTasks] = useState<Task[]>([]);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  // Mock sprint data
  const mockSprints: Sprint[] = [
    {
      id: "sprint-1",
      name: "Sprint 1 - Authentication",
      goal: "Implement user authentication and basic security",
      startDate: "2024-01-15T00:00:00Z",
      endDate: "2024-01-29T00:00:00Z",
      status: "ACTIVE",
      projectId,
      createdAt: "2024-01-10T00:00:00Z",
      updatedAt: "2024-01-10T00:00:00Z",
    },
    {
      id: "sprint-2",
      name: "Sprint 2 - Dashboard",
      goal: "Build the main dashboard and navigation",
      startDate: "2024-01-30T00:00:00Z",
      endDate: "2024-02-13T00:00:00Z",
      status: "PLANNING",
      projectId,
      createdAt: "2024-01-10T00:00:00Z",
      updatedAt: "2024-01-10T00:00:00Z",
    },
  ];

  // Mock backlog tasks
  const mockBacklogTasks: Task[] = [
    {
      id: "task-5",
      title: "Implement OAuth login",
      description: "Add social login options (Google, GitHub, etc.)",
      type: TaskType.STORY,
      priority: "HIGH",
      taskNumber: 5,
      projectId,
      // reporterId: "user-1",

      reporter: {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-1",
      status: {
        id: "status-1",
        name: "Backlog",
        color: "#6b7280",
        category: "TODO" as any,
        order: 0,
        isDefault: false,
        workflowId: "workflow-1",
      },
      storyPoints: 13,
      originalEstimate: 780,
      remainingEstimate: 780,
      createdAt: "2024-01-18T10:00:00Z",
      updatedAt: "2024-01-18T10:00:00Z",
    },
    {
      id: "task-6",
      title: "Create user profile page",
      description: "Design and implement user profile management",
      type: TaskType.STORY,
      priority: "MEDIUM",
      taskNumber: 6,
      projectId,
      // reporterId: "user-2",
      reporter: {
        id: "user-2",
        firstName: "Jane",
        lastName: "Smith",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-1",
      status: {
        id: "status-1",
        name: "Backlog",
        color: "#6b7280",
        category: "TODO" as any,
        order: 0,
        isDefault: false,
        workflowId: "workflow-1",
      },
      storyPoints: 5,
      originalEstimate: 300,
      remainingEstimate: 300,
      createdAt: "2024-01-19T09:00:00Z",
      updatedAt: "2024-01-19T09:00:00Z",
    },
    {
      id: "task-7",
      title: "Add email notifications",
      description: "Send email notifications for important events",
      type: TaskType.TASK,
      priority: "LOW",
      taskNumber: 7,
      projectId,
      // reporterId: "user-3",
      reporter: {
        id: "user-3",
        firstName: "Alice",
        lastName: "Johnson",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-1",
      status: {
        id: "status-1",
        name: "Backlog",
        color: "#6b7280",
        category: "TODO" as any,
        order: 0,
        isDefault: false,
        workflowId: "workflow-1",
      },
      storyPoints: 8,
      originalEstimate: 480,
      remainingEstimate: 480,
      createdAt: "2024-01-20T11:00:00Z",
      updatedAt: "2024-01-20T11:00:00Z",
    },
  ];

  const mockSprintTasks: Task[] = [
    {
      id: "task-1",
      title: "Setup JWT authentication",
      description: "Implement JWT token-based authentication system",
      type: TaskType.STORY,
      priority: "HIGH",
      taskNumber: 1,
      projectId,
      sprintId: "sprint-1",
      // reporterId: "user-1",
      reporter: {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-1",
      status: {
        id: "status-1",
        name: "Sprint Backlog",
        color: "#64748b",
        category: "TODO" as any,
        order: 1,
        isDefault: true,
        workflowId: "workflow-1",
      },
      storyPoints: 8,
      originalEstimate: 480,
      remainingEstimate: 480,
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Find the current sprint
        const sprint = sprintId ? mockSprints.find((s) => s.id === sprintId) : mockSprints[0];
        setCurrentSprint(sprint || null);

        setBacklogTasks(mockBacklogTasks);
        setSprintTasks(mockSprintTasks);
      } catch (error) {
        console.error("Error loading sprint planning data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId, sprintId]);

  // Client-side only date initialization to prevent hydration mismatch
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Helper function for consistent date formatting to prevent hydration issues
  const formatDate = (dateString: string) => {
    if (!currentDate) return "Loading...";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  const getTotalStoryPoints = (tasks: Task[]) => {
    return tasks.reduce((total, task) => total + (task.storyPoints || 0), 0);
  };

  const getTotalEstimate = (tasks: Task[]) => {
    return tasks.reduce((total, task) => total + (task.originalEstimate || 0), 0);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleBacklogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTask && draggedTask.sprintId === currentSprint?.id) {
      // Move task from sprint to backlog
      setSprintTasks((prev) => prev.filter((task) => task.id !== draggedTask.id));
      setBacklogTasks((prev) => [...prev, { ...draggedTask, sprintId: undefined }]);
    }
  };

  const handleSprintDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTask && !draggedTask.sprintId) {
      // Move task from backlog to sprint
      setBacklogTasks((prev) => prev.filter((task) => task.id !== draggedTask.id));
      setSprintTasks((prev) => [...prev, { ...draggedTask, sprintId: currentSprint?.id }]);
    }
  };

  const handleTaskClick = (task: Task) => {
    if (task.sprintId) {
      // Move from sprint to backlog
      setSprintTasks((prev) => prev.filter((t) => t.id !== task.id));
      setBacklogTasks((prev) => [...prev, { ...task, sprintId: undefined }]);
    } else {
      // Move from backlog to sprint
      setBacklogTasks((prev) => prev.filter((t) => t.id !== task.id));
      setSprintTasks((prev) => [...prev, { ...task, sprintId: currentSprint?.id }]);
    }
  };

  const renderTask = (task: Task, inSprint: boolean) => (
    <Card
      key={task.id}
      className={`sprints-planning-task-card ${
        draggedTask?.id === task.id ? "sprints-planning-task-card-dragging" : ""
      } ${inSprint ? "sprints-planning-task-card-sprint" : "sprints-planning-task-card-backlog"}`}
      draggable
      onDragStart={(e) => handleDragStart(e, task)}
      onDragEnd={handleDragEnd}
      onClick={() => handleTaskClick(task)}
    >
      <CardContent className="sprints-planning-task-content">
        <div className="sprints-planning-task-header">
          <div className="sprints-planning-task-type-row">
            <span className="sprints-planning-task-key"></span>
          </div>
          <div className="sprints-planning-task-badges">
            {(() => {
              const config = getPriorityConfig(task.priority);
              return (
                <Badge className={`sprints-planning-task-priority-badge ${config.className}`}>
                  {task.priority}
                </Badge>
              );
            })()}
            {task.storyPoints && (
              <Badge variant="secondary" className="sprints-planning-task-points-badge">
                {task.storyPoints} SP
              </Badge>
            )}
          </div>
        </div>

        <h4 className="sprints-planning-task-title">{task.title}</h4>

        {task.description && (
          <p className="sprints-planning-task-description">{task.description}</p>
        )}

        <div className="sprints-planning-task-footer">
          <div className="sprints-planning-task-labels">
            {/* {task.labels?.slice(0, 2).map((label) => (
              <Badge
                key={label.id}
                variant="secondary"
                className="sprints-planning-task-label"
                style={{
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                }}
              >
                {label.name}
              </Badge>
            ))} */}
          </div>
          <div className="sprints-planning-task-info">
            <div className="sprints-planning-task-time">
              <HiClock className="sprints-planning-task-time-icon" />
              {formatTime(task.originalEstimate || 0)}
            </div>
            {task.assignee && <UserAvatar user={task.assignee} size="xs" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!currentSprint) {
    return (
      <div className="sprints-empty-state">
        <div className="sprints-empty-icon-container">
          <HiCalendar className="sprints-empty-icon" />
        </div>
        <h3 className="sprints-empty-title">No Sprint Selected</h3>
        <p className="sprints-empty-description">
          Please select a sprint from the dropdown above to start planning.
        </p>
      </div>
    );
  }

  return (
    <div className="sprints-planning-container">
      {/* Header */}
      <div className="sprints-planning-header">
        <div>
          <h2 className="sprints-planning-title">
            <HiCalendar className="sprints-planning-title-icon" />
            Sprint Planning
          </h2>
          <p className="sprints-planning-subtitle">{currentSprint?.name || "Select a sprint"}</p>
        </div>
        <div className="sprints-planning-actions">
          <Button variant="outline" className="sprints-planning-save-button">
            <HiBookmark className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button className="sprints-planning-start-button">
            <HiPlay className="w-4 h-4 mr-2" />
            Start Sprint
          </Button>
        </div>
      </div>

      {/* Sprint Info */}
      <Card className="sprints-planning-info-card">
        <CardContent className="sprints-planning-info-content">
          <div className="sprints-planning-info-grid">
            <div>
              <h3 className="sprints-planning-info-section-title">
                <FiTarget className="sprints-planning-info-section-icon" />
                Sprint Goal
              </h3>
              <p className="sprints-planning-info-section-text">
                {currentSprint?.goal || "No goal set"}
              </p>
            </div>
            <div>
              <h3 className="sprints-planning-info-section-title">
                <HiCalendar className="sprints-planning-info-section-icon" />
                Duration
              </h3>
              <p className="sprints-planning-info-section-text">
                {currentSprint
                  ? `${formatDate(currentSprint.startDate)} - ${formatDate(currentSprint.endDate)}`
                  : "No dates set"}
              </p>
            </div>
            <div>
              <h3 className="sprints-planning-info-section-title">
                <HiUsers className="sprints-planning-info-section-icon" />
                Capacity
              </h3>
              <p className="sprints-planning-info-section-text">
                {(currentSprint as any)?.capacity || 0} hours
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planning Board */}
      <div className="sprints-planning-board">
        {/* Backlog */}
        <Card className="sprints-planning-column-card">
          <CardHeader className="sprints-planning-column-header">
            <div className="sprints-planning-column-title-row">
              <CardTitle className="sprints-planning-column-title">
                <HiClipboardDocumentList className="sprints-planning-column-icon" />
                Product Backlog
              </CardTitle>
              <div className="sprints-planning-column-meta">
                <span>{backlogTasks.length} tasks</span>
                <span>{getTotalStoryPoints(backlogTasks)} SP</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="sprints-planning-backlog-dropzone"
              onDragOver={handleDragOver}
              onDrop={handleBacklogDrop}
            >
              {backlogTasks.map((task) => renderTask(task, false))}
              {backlogTasks.length === 0 && (
                <div className="sprints-planning-empty">
                  <div className="sprints-planning-empty-icon-container">
                    <HiClipboardDocumentList className="sprints-planning-empty-icon" />
                  </div>
                  <p className="sprints-planning-empty-text">No tasks in backlog</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sprint */}
        <Card className="sprints-planning-column-card">
          <CardHeader className="sprints-planning-column-header">
            <div className="sprints-planning-column-title-row">
              <CardTitle className="sprints-planning-column-title">
                <HiFlag className="sprints-planning-column-icon-primary" />
                Sprint Backlog
              </CardTitle>
              <div className="sprints-planning-column-meta">
                <span>{sprintTasks.length} tasks</span>
                <span>{getTotalStoryPoints(sprintTasks)} SP</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="sprints-planning-sprint-dropzone"
              onDragOver={handleDragOver}
              onDrop={handleSprintDrop}
            >
              {sprintTasks.map((task) => renderTask(task, true))}
              {sprintTasks.length === 0 && (
                <div className="sprints-planning-empty">
                  <div className="sprints-planning-sprint-empty-icon-container">
                    <HiPlus className="sprints-planning-sprint-empty-icon" />
                  </div>
                  <p className="sprints-planning-sprint-empty-title">
                    Drag tasks here to add to sprint
                  </p>
                  <p className="sprints-planning-sprint-empty-subtitle">
                    Click tasks to move them between backlog and sprint
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sprint Summary */}
      <Card className="sprints-planning-summary-card">
        <CardHeader className="sprints-planning-summary-header">
          <CardTitle className="sprints-planning-summary-title">
            <HiChartBar className="sprints-planning-summary-title-icon" />
            Sprint Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sprints-planning-summary-grid">
            <div className="sprints-planning-summary-stat">
              <div className="sprints-planning-summary-stat-icon-container-blue sprints-planning-summary-stat-icon-container-blue-dark">
                <HiClipboardDocumentList className="sprints-planning-summary-stat-icon-blue sprints-planning-summary-stat-icon-blue-dark" />
              </div>
              <div className="sprints-planning-summary-stat-value">{sprintTasks.length}</div>
              <div className="sprints-planning-summary-stat-label">Tasks</div>
            </div>
            <div className="sprints-planning-summary-stat">
              <div className="sprints-planning-summary-stat-icon-container-green sprints-planning-summary-stat-icon-container-green-dark">
                <HiFlag className="sprints-planning-summary-stat-icon-green sprints-planning-summary-stat-icon-green-dark" />
              </div>
              <div className="sprints-planning-summary-stat-value">
                {getTotalStoryPoints(sprintTasks)}
              </div>
              <div className="sprints-planning-summary-stat-label">Story Points</div>
            </div>
            <div className="sprints-planning-summary-stat">
              <div className="sprints-planning-summary-stat-icon-container-purple sprints-planning-summary-stat-icon-container-purple-dark">
                <HiClock className="sprints-planning-summary-stat-icon-purple sprints-planning-summary-stat-icon-purple-dark" />
              </div>
              <div className="sprints-planning-summary-stat-value">
                {formatTime(getTotalEstimate(sprintTasks))}
              </div>
              <div className="sprints-planning-summary-stat-label">Estimated Time</div>
            </div>
            <div className="sprints-planning-summary-stat">
              <div className="sprints-planning-summary-stat-icon-container-orange sprints-planning-summary-stat-icon-container-orange-dark">
                <HiUsers className="sprints-planning-summary-stat-icon-orange sprints-planning-summary-stat-icon-orange-dark" />
              </div>
              <div className="sprints-planning-summary-stat-value">
                {(currentSprint as any)?.capacity || 0}h
              </div>
              <div className="sprints-planning-summary-stat-label">Capacity</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
