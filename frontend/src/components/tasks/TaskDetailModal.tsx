import { useState } from "react";
import { Task, TaskDependency, DependencyType, TimeEntry } from "@/types/tasks";
import { Button } from "@/components/ui";
import TaskDependencies from "./TaskDependencies";
import TaskHierarchy from "./TaskHierarchy";
import TimeTracking from "./TimeTracking";

interface TaskDetailModalProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export default function TaskDetailModal({
  task,
  allTasks,
  onClose,
  onUpdate,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "dependencies" | "hierarchy" | "time">(
    "details"
  );

  const handleAddDependency = (taskId: string, dependsOnTaskId: string, type: DependencyType) => {
    const newDependency: TaskDependency = {
      id: `dep-${Date.now()}`,
      type,
      dependentTaskId: taskId,
      blockingTaskId: dependsOnTaskId,
      createdById: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedTask = {
      ...task,
      dependsOn: [...(task.dependsOn || []), newDependency],
    };
    onUpdate(updatedTask);
  };

  const handleRemoveDependency = (dependencyId: string) => {
    const updatedTask = {
      ...task,
      dependsOn: task.dependsOn?.filter((dep) => dep.id !== dependencyId) || [],
    };
    onUpdate(updatedTask);
  };

  const handleUpdateDependency = (dependencyId: string, type: DependencyType) => {
    const updatedTask = {
      ...task,
      dependsOn:
        task.dependsOn?.map((dep) => (dep.id === dependencyId ? { ...dep, type } : dep)) || [],
    };
    onUpdate(updatedTask);
  };

  const handleCreateSubtask = (parentId: string, subtaskData: any) => {
    const newSubtask: Task = {
      id: `task-${Date.now()}`,
      ...subtaskData,
      key: `${task.slug}-${Date.now()}`,
      taskNumber: Date.now(),
      parentTaskId: parentId,
      projectId: task.projectId,
      reporterId: "user-1",
      reporter: task.reporter,
      statusId: task.statusId,
      status: task.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleConvertToSubtask = (taskId: string, parentId: string) => {
    const updatedTask = {
      ...task,
      parentTaskId: parentId,
    };
    onUpdate(updatedTask);
  };

  const handlePromoteToParent = (taskId: string) => {
    const updatedTask = {
      ...task,
      parentTaskId: undefined,
    };
    onUpdate(updatedTask);
  };

  const handleMoveSubtask = (taskId: string, newParentId: string) => {};

  const handleLogTime = (timeEntry: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">) => {
    const newTimeEntry: TimeEntry = {
      id: `time-${Date.now()}`,
      ...timeEntry,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedTask = {
      ...task,
      timeEntries: [...(task.timeEntries || []), newTimeEntry],
    };
    onUpdate(updatedTask);
  };

  const handleUpdateTime = (timeEntryId: string, timeEntry: Partial<TimeEntry>) => {
    const updatedTask = {
      ...task,
      timeEntries:
        task.timeEntries?.map((entry) =>
          entry.id === timeEntryId
            ? { ...entry, ...timeEntry, updatedAt: new Date().toISOString() }
            : entry
        ) || [],
    };
    onUpdate(updatedTask);
  };

  const handleDeleteTime = (timeEntryId: string) => {
    const updatedTask = {
      ...task,
      timeEntries: task.timeEntries?.filter((entry) => entry.id !== timeEntryId) || [],
    };
    onUpdate(updatedTask);
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "BUG":
        return "🐛";
      case "STORY":
        return "📖";
      case "EPIC":
        return "🎯";
      case "SUBTASK":
        return "📝";
      default:
        return "📋";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGHEST":
        return "text-red-600 bg-red-100 dark:bg-red-900/20";
      case "HIGH":
        return "text-orange-600 bg-orange-100 dark:bg-orange-900/20";
      case "MEDIUM":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20";
      case "LOW":
        return "text-green-600 bg-green-100 dark:bg-green-900/20";
      case "LOWEST":
        return "text-gray-600 bg-gray-100 dark:bg-gray-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-900/20";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className="text-xl">{getTaskTypeIcon(task.type)}</span>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {task.slug}: {task.title}
                </h2>
                <div className="flex items-center space-x-3 mt-1">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}
                  >
                    {task.priority}
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                    {task.status.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{task.type}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab("details")}
                className={`py-2 px-1 text-sm font-medium border-b-2 ${
                  activeTab === "details"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab("dependencies")}
                className={`py-2 px-1 text-sm font-medium border-b-2 ${
                  activeTab === "dependencies"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Dependencies
                {task.dependsOn && task.dependsOn.length > 0 && (
                  <span className="ml-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 text-xs px-2 py-1 rounded-full">
                    {task.dependsOn.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("hierarchy")}
                className={`py-2 px-1 text-sm font-medium border-b-2 ${
                  activeTab === "hierarchy"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Hierarchy
                {task.childTasks && task.childTasks.length > 0 && (
                  <span className="ml-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 text-xs px-2 py-1 rounded-full">
                    {task.childTasks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("time")}
                className={`py-2 px-1 text-sm font-medium border-b-2 ${
                  activeTab === "time"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Time Tracking
                {task.timeEntries && task.timeEntries.length > 0 && (
                  <span className="ml-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 text-xs px-2 py-1 rounded-full">
                    {task.timeEntries.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[500px]">
            {activeTab === "details" && (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
                    Task Details
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Comprehensive task editing interface will be implemented here.
                  </p>
                  <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                    <p>
                      <strong>Description:</strong> {task.description || "No description"}
                    </p>
                    <p>
                      <strong>Reporter:</strong> {task.reporter.firstName} {task.reporter.lastName}
                    </p>
                    {task.assignee && (
                      <p>
                        <strong>Assignee:</strong> {task.assignee.firstName}{" "}
                        {task.assignee.lastName}
                      </p>
                    )}
                    {task.dueDate && (
                      <p>
                        <strong>Due Date:</strong> {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    {task.storyPoints && (
                      <p>
                        <strong>Story Points:</strong> {task.storyPoints}
                      </p>
                    )}
                    {task.originalEstimate && (
                      <p>
                        <strong>Original Estimate:</strong> {task.originalEstimate / 60} hours
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "dependencies" && (
              <TaskDependencies
                task={task}
                allTasks={allTasks}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
                onUpdateDependency={handleUpdateDependency}
              />
            )}

            {activeTab === "hierarchy" && (
              <TaskHierarchy
                task={task}
                allTasks={allTasks}
                onCreateSubtask={handleCreateSubtask}
                onConvertToSubtask={handleConvertToSubtask}
                onPromoteToParent={handlePromoteToParent}
                onMoveSubtask={handleMoveSubtask}
              />
            )}

            {activeTab === "time" && (
              <TimeTracking
                task={task}
                onLogTime={handleLogTime}
                onUpdateTime={handleUpdateTime}
                onDeleteTime={handleDeleteTime}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
