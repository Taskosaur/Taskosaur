import React, { useState, useEffect } from "react";
import TaskColumn from "@/components/tasks/TaskColumn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SprintSelector from "./SprintSelector";
import SprintProgress from "./SprintProgress";
import {
  HiPlay,
  HiCheck,
  HiClock,
  HiCalendar,
  HiFlag,
  HiChartBar,
  HiClipboardDocumentList,
} from "react-icons/hi2";
import { HiLightningBolt } from "react-icons/hi";
import { Sprint, Task, TaskStatus } from "@/types";
interface SprintBoardProps {
  projectId: string;
  sprintId?: string;
}

const LoadingSkeleton = () => (
  <div className="sprints-loading-container">
    <div className="sprints-loading-skeleton">
      <div className="sprints-loading-title"></div>
      <div className="sprints-loading-subtitle"></div>
      <div className="sprints-loading-columns">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sprints-loading-column">
            <div className="sprints-loading-column-title"></div>
            <div className="sprints-loading-tasks">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="sprints-loading-task"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const getSprintStatusConfig = (status: string) => {
  switch (status) {
    case "PLANNED":
      return {
        className: "sprints-status-planned sprints-status-planned-dark",
        icon: HiClock,
      };
    case "ACTIVE":
      return {
        className: "sprints-status-active sprints-status-active-dark",
        icon: HiPlay,
      };
    case "COMPLETED":
      return {
        className: "sprints-status-completed sprints-status-completed-dark",
        icon: HiCheck,
      };
    default:
      return {
        className: "sprints-status-default",
        icon: HiClock,
      };
  }
};

export default function SprintBoard({ projectId, sprintId }: SprintBoardProps) {
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  // Mock data - in real app, this would come from API
  const mockStatuses: TaskStatus[] = [
    {
      id: "status-1",
      name: "Sprint Backlog",
      description: "Tasks planned for this sprint",
      color: "#64748b",
      category: "TODO" as any,
      order: 1,
      isDefault: true,
      workflowId: "workflow-1",
    },
    {
      id: "status-2",
      name: "In Progress",
      description: "Tasks currently being worked on",
      color: "#f59e0b",
      category: "IN_PROGRESS" as any,
      order: 2,
      isDefault: false,
      workflowId: "workflow-1",
    },
    {
      id: "status-3",
      name: "Testing",
      description: "Tasks being tested",
      color: "#3b82f6",
      category: "IN_PROGRESS" as any,
      order: 3,
      isDefault: false,
      workflowId: "workflow-1",
    },
    {
      id: "status-4",
      name: "Done",
      description: "Completed tasks",
      color: "#10b981",
      category: "DONE" as any,
      order: 4,
      isDefault: false,
      workflowId: "workflow-1",
    },
  ];

  const mockSprints: Sprint[] = [
    {
      id: "sprint-1",
      name: "Sprint 1 - Authentication",
      goal: "Implement user authentication and basic security features",
      startDate: "2024-01-15",
      endDate: "2024-01-29",
      status: "ACTIVE" as any,
      projectId,
      capacity: 120,
      velocity: 0,
      createdAt: "2024-01-10T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
    {
      id: "sprint-2",
      name: "Sprint 2 - Dashboard",
      goal: "Build the main dashboard and navigation",
      startDate: "2024-01-30",
      endDate: "2024-02-13",
      status: "PLANNED" as any,
      projectId,
      capacity: 100,
      velocity: 0,
      createdAt: "2024-01-10T10:00:00Z",
      updatedAt: "2024-01-10T10:00:00Z",
    },
  ];

  const mockSprintTasks: Task[] = [
    {
      id: "task-1",
      title: "Setup JWT authentication",
      description: "Implement JWT token-based authentication system",
      type: "STORY" as any,
      priority: "HIGH" as any,
      taskNumber: 1,
      projectId,
      sprintId: "sprint-1",
      // reporter: 'user-1',
      reporter: {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-2",
      status: mockStatuses[1],
      // assigneeId: 'user-2',
      assignee: {
        id: "user-2",
        firstName: "Jane",
        lastName: "Smith",
        avatar: "/api/placeholder/40/40",
      },
      storyPoints: 8,
      originalEstimate: 480,
      remainingEstimate: 240,
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-18T14:30:00Z",
    },
    {
      id: "task-2",
      title: "Create login/register forms",
      description: "Design and implement user-friendly login and registration forms",
      type: "STORY" as any,
      priority: "HIGH" as any,
      taskNumber: 2,
      projectId,
      sprintId: "sprint-1",
      // reporter: 'user-1',
      reporter: {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-4",
      status: mockStatuses[3],
      // assigneeId: 'user-3',
      assignee: {
        id: "user-3",
        firstName: "Alice",
        lastName: "Johnson",
        avatar: "/api/placeholder/40/40",
      },
      storyPoints: 5,
      originalEstimate: 300,
      remainingEstimate: 0,
      completedAt: "2024-01-20T16:00:00Z",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-20T16:00:00Z",
    },
    {
      id: "task-3",
      title: "Implement password reset",
      description: "Add forgot password and reset password functionality",
      type: "STORY" as any,
      priority: "MEDIUM" as any,
      taskNumber: 3,
      projectId,
      sprintId: "sprint-1",
      // reporter: 'user-2',
      reporter: {
        id: "user-2",
        firstName: "Jane",
        lastName: "Smith",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-1",
      status: mockStatuses[0],
      // assigneeId: 'user-1',
      assignee: {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatar: "/api/placeholder/40/40",
      },
      storyPoints: 3,
      originalEstimate: 180,
      remainingEstimate: 180,
      createdAt: "2024-01-16T09:00:00Z",
      updatedAt: "2024-01-16T09:00:00Z",
    },
    {
      id: "task-4",
      title: "Add email verification",
      description: "Implement email verification for new user accounts",
      type: "STORY" as any,
      priority: "LOW" as any,
      taskNumber: 4,
      projectId,
      sprintId: "sprint-1",
      // reporter: 'user-3',
      reporter: {
        id: "user-3",
        firstName: "Alice",
        lastName: "Johnson",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-3",
      status: mockStatuses[2],
      // assigneeId: 'user-2',
      assignee: {
        id: "user-2",
        firstName: "Jane",
        lastName: "Smith",
        avatar: "/api/placeholder/40/40",
      },
      storyPoints: 2,
      originalEstimate: 120,
      remainingEstimate: 60,
      createdAt: "2024-01-17T11:00:00Z",
      updatedAt: "2024-01-21T15:30:00Z",
    },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Mock API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        setSprints(mockSprints);
        setStatuses(mockStatuses);

        // Set current sprint
        const sprint = sprintId
          ? mockSprints.find((s) => s.id === sprintId)
          : mockSprints.find((s) => s.status === "ACTIVE");

        if (sprint) {
          setCurrentSprint(sprint);
          // Filter tasks for current sprint
          const sprintTasks = mockSprintTasks.filter((task) => task.sprintId === sprint.id);
          setTasks(sprintTasks);
        }
      } catch (error) {
        console.error("Error loading sprint data:", error);
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

  const getFilteredTasks = (statusId: string) => {
    return tasks.filter((task) => task.statusId === statusId);
  };

  const handleTaskMove = async (taskId: string, newStatusId: string) => {
    try {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                statusId: newStatusId,
                status: statuses.find((s) => s.id === newStatusId) || task.status,
                completedAt:
                  statuses.find((s) => s.id === newStatusId)?.category === "DONE"
                    ? currentDate?.toISOString() || new Date().toISOString()
                    : undefined,
              }
            : task
        )
      );
    } catch (error) {
      console.error("Error moving task:", error);
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDrop = (statusId: string) => {
    if (draggedTask && draggedTask.statusId !== statusId) {
      handleTaskMove(draggedTask.id, statusId);
    }
  };

  const handleSprintChange = (sprint: Sprint) => {
    setCurrentSprint(sprint);
    // Filter tasks for selected sprint
    const sprintTasks = mockSprintTasks.filter((task) => task.sprintId === sprint.id);
    setTasks(sprintTasks);
  };

  const handleStartSprint = () => {
    if (currentSprint) {
      const updatedSprint = {
        ...currentSprint,
        status: "ACTIVE" as any,
        startDate: (currentDate || new Date()).toISOString().split("T")[0],
      };
      setCurrentSprint(updatedSprint);
    }
  };

  const handleCompleteSprint = () => {
    if (currentSprint) {
      const updatedSprint = {
        ...currentSprint,
        status: "COMPLETED" as any,
        endDate: (currentDate || new Date()).toISOString().split("T")[0],
      };
      setCurrentSprint(updatedSprint);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!currentSprint) {
    return (
      <div className="sprints-empty-state">
        <div className="sprints-empty-icon-container">
          <HiLightningBolt className="sprints-empty-icon" />
        </div>
        <h3 className="sprints-empty-title">No Sprint Selected</h3>
        <p className="sprints-empty-description">Please select a sprint to view the board</p>
      </div>
    );
  }

  const sprintStatusConfig = getSprintStatusConfig(currentSprint.status);
  const StatusIcon = sprintStatusConfig.icon;

  // Calculate sprint statistics
  const completedTasks = tasks.filter((task) => task.status?.category === "DONE").length;
  const totalStoryPoints = tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
  const completedStoryPoints = tasks
    .filter((task) => task.status?.category === "DONE")
    .reduce((sum, task) => sum + (task.storyPoints || 0), 0);

  return (
    <div className="sprints-loading-container">
      {/* Sprint Header Card */}
      <Card className="sprints-header-card">
        <CardContent className="sprints-header-content">
          <div className="sprints-header-layout">
            {/* Sprint Info */}
            <div className="sprints-header-info">
              <div className="sprints-header-icon">
                <HiLightningBolt className="sprints-header-icon-lightning" />
              </div>
              <div className="sprints-header-details">
                <div className="sprints-header-title-row">
                  <h2 className="sprints-header-title">{currentSprint.name}</h2>
                  <Badge className={sprintStatusConfig.className}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {currentSprint.status}
                  </Badge>
                </div>
                <p className="sprints-header-goal">{currentSprint.goal}</p>
                <div className="sprints-header-meta">
                  <div className="sprints-header-meta-item">
                    <HiCalendar className="sprints-header-meta-icon" />
                    {formatDate(currentSprint.startDate)} - {formatDate(currentSprint.endDate)}
                  </div>
                  <div className="sprints-header-meta-item">
                    <HiClipboardDocumentList className="sprints-header-meta-icon" />
                    {completedTasks}/{tasks.length} tasks
                  </div>
                  <div className="sprints-header-meta-item">
                    <HiFlag className="sprints-header-meta-icon" />
                    {completedStoryPoints}/{totalStoryPoints} points
                  </div>
                </div>
              </div>
            </div>

            {/* Sprint Actions */}
            <div className="sprints-header-actions">
              <SprintSelector
                currentSprint={currentSprint}
                sprints={sprints}
                onSprintChange={handleSprintChange}
              />

              {currentSprint.status === "PLANNING" && (
                <Button onClick={handleStartSprint} className="sprints-start-button">
                  <HiPlay className="sprints-button-icon" />
                  Start Sprint
                </Button>
              )}

              {currentSprint.status === "ACTIVE" && (
                <Button
                  onClick={handleCompleteSprint}
                  variant="outline"
                  className="sprints-complete-button"
                >
                  <HiCheck className="sprints-button-icon" />
                  Complete Sprint
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sprint Progress */}
      <SprintProgress selectedSprint={currentSprint.id} />

      {/* Sprint Board */}
      <div className="sprints-board-grid">
        {statuses.map((status) => (
          <TaskColumn
            key={status.id}
            status={status}
            tasks={getFilteredTasks(status.id)}
            allTasks={tasks}
            onTaskMove={handleTaskMove}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            draggedTask={draggedTask}
          />
        ))}
      </div>

      {/* Sprint Statistics */}
      <div className="sprints-stats-grid">
        <Card className="sprints-stats-card">
          <CardContent className="sprints-stats-content">
            <div className="sprints-stats-item">
              <div className="sprints-stats-icon-container-blue sprints-stats-icon-container-blue-dark">
                <HiClipboardDocumentList className="sprints-stats-icon-blue sprints-stats-icon-blue-dark" />
              </div>
              <div>
                <p className="sprints-stats-value">
                  {completedTasks}/{tasks.length}
                </p>
                <p className="sprints-stats-label">Tasks Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="sprints-stats-card">
          <CardContent className="sprints-stats-content">
            <div className="sprints-stats-item">
              <div className="sprints-stats-icon-container-green sprints-stats-icon-container-green-dark">
                <HiFlag className="sprints-stats-icon-green sprints-stats-icon-green-dark" />
              </div>
              <div>
                <p className="sprints-stats-value">
                  {completedStoryPoints}/{totalStoryPoints}
                </p>
                <p className="sprints-stats-label">Story Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="sprints-stats-card">
          <CardContent className="sprints-stats-content">
            <div className="sprints-stats-item">
              <div className="sprints-stats-icon-container-purple sprints-stats-icon-container-purple-dark">
                <HiChartBar className="sprints-stats-icon-purple sprints-stats-icon-purple-dark" />
              </div>
              <div>
                <p className="sprints-stats-value">
                  {tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%
                </p>
                <p className="sprints-stats-label">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
