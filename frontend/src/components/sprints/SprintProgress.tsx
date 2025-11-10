import React, { useState, useEffect } from "react";
import { Task, Sprint } from "@/types";

interface SprintProgressProps {
  selectedSprint?: string | null;
}

export default function SprintProgress({ selectedSprint }: SprintProgressProps) {
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      projectId: "project-1",
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
      projectId: "project-1",
      createdAt: "2024-01-10T00:00:00Z",
      updatedAt: "2024-01-10T00:00:00Z",
    },
  ];

  // Mock tasks data
  const mockTasks: Task[] = [
    {
      id: "task-1",
      title: "Setup JWT authentication",
      description: "Implement JWT token-based authentication system",
      type: "STORY" as any,
      priority: "HIGH" as any,
      taskNumber: 1,
      projectId: "project-1",
      // reporterId: 'user-1',
      reporter: {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-2",
      status: {
        id: "status-2",
        name: "In Progress",
        color: "#f59e0b",
        category: "IN_PROGRESS" as any,
        order: 1,
        isDefault: false,
        workflowId: "workflow-1",
      },
      storyPoints: 8,
      createdAt: "2024-01-15T09:00:00Z",
      updatedAt: "2024-01-15T09:00:00Z",
    },
    {
      id: "task-2",
      title: "Create login form",
      description: "Design and implement user login form",
      type: "STORY" as any,
      priority: "MEDIUM" as any,
      taskNumber: 2,
      projectId: "project-1",
      // reporterId: 'user-1',
      reporter: {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatar: "/api/placeholder/40/40",
      },
      statusId: "status-5",
      status: {
        id: "status-5",
        name: "Done",
        color: "#10b981",
        category: "DONE" as any,
        order: 4,
        isDefault: false,
        workflowId: "workflow-1",
      },
      storyPoints: 5,
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Find the current sprint
        const sprint = selectedSprint
          ? mockSprints.find((s) => s.id === selectedSprint)
          : mockSprints[0];
        setCurrentSprint(sprint || null);

        // Filter tasks for current sprint
        const sprintTasks = mockTasks.filter((task) => task.sprintId === selectedSprint);
        setTasks(sprintTasks);
      } catch (error) {
        console.error("Error loading sprint progress data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedSprint]);

  // Client-side only date initialization to prevent hydration mismatch
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Helper function for consistent date formatting to prevent hydration issues
  const formatDate = (dateString: string) => {
    if (!currentDate) return "Loading...";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  const getTotalStoryPoints = () => {
    return tasks.reduce((total, task) => total + (task.storyPoints || 0), 0);
  };

  const getCompletedStoryPoints = () => {
    return tasks
      .filter((task) => task.status.category === "DONE")
      .reduce((total, task) => total + (task.storyPoints || 0), 0);
  };

  const getTotalTimeSpent = () => {
    return tasks.reduce((total, task) => {
      // const timeSpent = task.timeEntries?.reduce((taskTotal, entry) => taskTotal + entry.timeSpent, 0) || 0;
      return total + 0;
    }, 0);
  };

  const getTotalOriginalEstimate = () => {
    return tasks.reduce((total, task) => total + (task.originalEstimate || 0), 0);
  };

  const getRemainingEstimate = () => {
    return tasks.reduce((total, task) => total + (task.remainingEstimate || 0), 0);
  };

  const getCompletionPercentage = () => {
    const total = getTotalStoryPoints();
    const completed = getCompletedStoryPoints();
    return total > 0 ? (completed / total) * 100 : 0;
  };

  const getTimePercentage = () => {
    const estimate = getTotalOriginalEstimate();
    const spent = getTotalTimeSpent();
    return estimate > 0 ? (spent / estimate) * 100 : 0;
  };

  const getTasksByStatus = () => {
    const statusCounts = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    };

    tasks.forEach((task) => {
      statusCounts[task.status.category]++;
    });

    return statusCounts;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getDaysRemaining = () => {
    if (!currentSprint || !currentDate) return 0;
    const endDate = new Date(currentSprint.endDate);
    const diffTime = endDate.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getSprintProgress = () => {
    if (!currentSprint || !currentDate) return 0;
    const startDate = new Date(currentSprint.startDate);
    const endDate = new Date(currentSprint.endDate);

    if (currentDate < startDate) return 0;
    if (currentDate > endDate) return 100;

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = currentDate.getTime() - startDate.getTime();
    return (elapsed / totalDuration) * 100;
  };

  if (isLoading) {
    return (
      <div className="sprints-progress-loading">
        <div className="sprints-progress-loading-spinner"></div>
      </div>
    );
  }

  if (!currentSprint) {
    return (
      <div className="sprints-progress-empty">
        <div className="sprints-progress-empty-content">
          <h3 className="sprints-progress-empty-title sprints-progress-empty-title-dark">
            No Sprint Selected
          </h3>
          <p className="sprints-progress-empty-subtitle sprints-progress-empty-subtitle-dark">
            Please select a sprint from the dropdown above to view progress.
          </p>
        </div>
      </div>
    );
  }

  const completionPercentage = getCompletionPercentage();
  const timePercentage = getTimePercentage();
  const statusCounts = getTasksByStatus();
  const daysRemaining = getDaysRemaining();
  const sprintProgress = getSprintProgress();

  return (
    <div className="sprints-progress-container sprints-progress-container-dark">
      <h3 className="sprints-progress-title sprints-progress-title-dark">Sprint Progress</h3>

      {/* Sprint Timeline */}
      <div className="sprints-progress-timeline">
        <div className="sprints-progress-timeline-header">
          <span className="sprints-progress-timeline-label sprints-progress-timeline-label-dark">
            Sprint Timeline
          </span>
          <span className="sprints-progress-timeline-remaining sprints-progress-timeline-remaining-dark">
            {daysRemaining > 0 ? `${daysRemaining} days remaining` : "Sprint ended"}
          </span>
        </div>
        <div className="sprints-progress-bar-container sprints-progress-bar-container-dark">
          <div
            className="sprints-progress-bar"
            style={{ width: `${Math.min(100, sprintProgress)}%` }}
          />
        </div>
        <div className="sprints-progress-timeline-dates sprints-progress-timeline-dates-dark">
          <span>{formatDate(currentSprint.startDate)}</span>
          <span>{formatDate(currentSprint.endDate)}</span>
        </div>
      </div>

      {/* Progress Stats */}
      <div className="sprints-progress-stats">
        {/* Story Points */}
        <div className="sprints-progress-stat">
          <div className="sprints-progress-stat-value-indigo sprints-progress-stat-value-indigo-dark">
            {getCompletedStoryPoints()}/{getTotalStoryPoints()}
          </div>
          <div className="sprints-progress-stat-label sprints-progress-stat-label-dark">
            Story Points
          </div>
          <div className="sprints-progress-bar-container sprints-progress-bar-container-dark">
            <div
              className="sprints-progress-stat-bar-indigo"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="sprints-progress-stat-meta sprints-progress-stat-meta-dark">
            {Math.round(completionPercentage)}% complete
          </div>
        </div>

        {/* Time Tracking */}
        <div className="sprints-progress-stat">
          <div className="sprints-progress-stat-value-green sprints-progress-stat-value-green-dark">
            {formatTime(getTotalTimeSpent())}
          </div>
          <div className="sprints-progress-stat-label sprints-progress-stat-label-dark">
            Time Spent
          </div>
          <div className="sprints-progress-bar-container sprints-progress-bar-container-dark">
            <div
              className={
                timePercentage > 100
                  ? "sprints-progress-stat-bar-red"
                  : "sprints-progress-stat-bar-green"
              }
              style={{ width: `${Math.min(100, timePercentage)}%` }}
            />
          </div>
          <div className="sprints-progress-stat-meta sprints-progress-stat-meta-dark">
            {formatTime(getTotalOriginalEstimate())} estimated
          </div>
        </div>

        {/* Tasks */}
        <div className="sprints-progress-stat">
          <div className="sprints-progress-stat-value-purple sprints-progress-stat-value-purple-dark">
            {statusCounts.DONE}/{tasks.length}
          </div>
          <div className="sprints-progress-stat-label sprints-progress-stat-label-dark">
            Tasks Complete
          </div>
          <div className="sprints-progress-bar-container sprints-progress-bar-container-dark">
            <div
              className="sprints-progress-stat-bar-purple"
              style={{
                width: `${tasks.length > 0 ? (statusCounts.DONE / tasks.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="sprints-progress-stat-meta sprints-progress-stat-meta-dark">
            {statusCounts.IN_PROGRESS} in progress
          </div>
        </div>

        {/* Velocity */}
        <div className="sprints-progress-stat">
          <div className="sprints-progress-stat-value-orange sprints-progress-stat-value-orange-dark">
            {(currentSprint as any)?.velocity || 0}
          </div>
          <div className="sprints-progress-stat-label sprints-progress-stat-label-dark">
            Velocity
          </div>
          <div className="sprints-progress-stat-meta sprints-progress-stat-meta-dark">
            Story points per day
          </div>
          <div className="sprints-progress-stat-meta sprints-progress-stat-meta-dark">
            Capacity: {(currentSprint as any)?.capacity || 0}h
          </div>
        </div>
      </div>

      {/* Burndown Chart Placeholder */}
      <div className="sprints-progress-burndown sprints-progress-burndown-dark">
        <h4 className="sprints-progress-burndown-title sprints-progress-burndown-title-dark">
          Sprint Burndown
        </h4>
        <div className="sprints-progress-burndown-placeholder sprints-progress-burndown-placeholder-dark">
          <div className="sprints-progress-burndown-content">
            <svg
              className="sprints-progress-burndown-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="sprints-progress-burndown-text sprints-progress-burndown-text-dark">
              Burndown chart will be implemented here
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="sprints-progress-actions sprints-progress-actions-dark">
        <div className="sprints-progress-actions-header">
          <h4 className="sprints-progress-actions-title sprints-progress-actions-title-dark">
            Quick Actions
          </h4>
          <div className="sprints-progress-actions-buttons">
            <button className="sprints-progress-action-button sprints-progress-action-button-dark">
              View Sprint Report
            </button>
            <span className="sprints-progress-actions-divider sprints-progress-actions-divider-dark">
              |
            </span>
            <button className="sprints-progress-action-button sprints-progress-action-button-dark">
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
