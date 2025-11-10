import { useState } from "react";
import { Task, TaskDependency, DependencyType } from "@/types/tasks";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { Button } from "@/components/ui";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

interface TaskDependenciesProps {
  task: Task;
  allTasks: Task[];
  onAddDependency: (taskId: string, dependsOnTaskId: string, type: DependencyType) => void;
  onRemoveDependency: (dependencyId: string) => void;
  onUpdateDependency: (dependencyId: string, type: DependencyType) => void;
}

export default function TaskDependencies({
  task,
  allTasks,
  onAddDependency,
  onRemoveDependency,
}: TaskDependenciesProps) {
  const [showAddDependency, setShowAddDependency] = useState(false);
  const [newDependency, setNewDependency] = useState({
    taskId: "",
    type: DependencyType.BLOCKS,
  });
  const [dependencyToRemove, setDependencyToRemove] = useState<TaskDependency | null>(null);

  const availableTasks = allTasks.filter(
    (t) =>
      t.id !== task.id &&
      t.parentTaskId !== task.id &&
      !task.dependsOn?.some((dep) => dep.blockingTaskId === t.id)
  );

  const getDependencyTypeIcon = (type: DependencyType) => {
    switch (type) {
      case DependencyType.BLOCKS:
        return "🚫";
      case DependencyType.FINISH_START:
        return "⏭️";
      case DependencyType.START_START:
        return "▶️";
      case DependencyType.FINISH_FINISH:
        return "⏹️";
      case DependencyType.START_FINISH:
        return "🔄";
      default:
        return "🔗";
    }
  };

  const getDependencyTypeDescription = (type: DependencyType) => {
    switch (type) {
      case DependencyType.BLOCKS:
        return "Blocks this task";
      case DependencyType.FINISH_START:
        return "Must finish before this task starts";
      case DependencyType.START_START:
        return "Must start before this task starts";
      case DependencyType.FINISH_FINISH:
        return "Must finish before this task finishes";
      case DependencyType.START_FINISH:
        return "Must start before this task finishes";
      default:
        return "Related task";
    }
  };

  const handleAddDependency = () => {
    if (newDependency.taskId) {
      onAddDependency(task.id, newDependency.taskId, newDependency.type);
      setNewDependency({ taskId: "", type: DependencyType.BLOCKS });
      setShowAddDependency(false);
    }
  };

  const handleRemoveDependency = (dependency: TaskDependency) => {
    onRemoveDependency(dependency.id);
    setDependencyToRemove(null);
  };

  const getBlockingTask = (dependency: TaskDependency) => {
    return allTasks.find((t) => t.id === dependency.blockingTaskId);
  };

  const getTasksBlockedByThis = () => {
    return allTasks.filter((t) => t.dependsOn?.some((dep) => dep.blockingTaskId === task.id));
  };

  return (
    <div className="space-y-6">
      {/* Dependencies (Tasks this task depends on) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dependencies</h3>
          <Button variant="outline" onClick={() => setShowAddDependency(true)}>
            Add Dependency
          </Button>
        </div>

        {task.dependsOn && task.dependsOn.length > 0 ? (
          <div className="space-y-3">
            {task.dependsOn.map((dependency) => {
              const blockingTask = getBlockingTask(dependency);
              if (!blockingTask) return null;

              return (
                <div
                  key={dependency.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getDependencyTypeIcon(dependency.type)}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          {blockingTask.title}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {getDependencyTypeDescription(dependency.type)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          blockingTask.status.category === "DONE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                        }`}
                      >
                        {blockingTask.status.name}
                      </span>
                      {blockingTask.assignee && (
                        <UserAvatar user={blockingTask.assignee} size="xs" />
                      )}
                    </div>
                    <button
                      onClick={() => setDependencyToRemove(dependency)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <p>No dependencies</p>
            <p className="text-sm">This task doesn't depend on any other tasks</p>
          </div>
        )}
      </div>

      {/* Blocked Tasks (Tasks that depend on this task) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Blocked Tasks</h3>

        {(() => {
          const blockedTasks = getTasksBlockedByThis();
          return blockedTasks.length > 0 ? (
            <div className="space-y-3">
              {blockedTasks.map((blockedTask) => {
                const dependency = blockedTask.dependsOn?.find(
                  (dep) => dep.blockingTaskId === task.id
                );
                if (!dependency) return null;

                return (
                  <div
                    key={blockedTask.id}
                    className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getDependencyTypeIcon(dependency.type)}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600 dark:text-gray-400">
                            {blockedTask.title}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Waiting for this task to be completed
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          blockedTask.status.category === "DONE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {blockedTask.status.name}
                      </span>
                      {blockedTask.assignee && <UserAvatar user={blockedTask.assignee} size="xs" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>No blocked tasks</p>
              <p className="text-sm">No other tasks are waiting for this task to be completed</p>
            </div>
          );
        })()}
      </div>

      {/* Add Dependency Modal */}
      {showAddDependency && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Dependency
            </h3>

            <div className="space-y-4">
              <div>
                <label className="form-label-primary mb-2">Task that blocks this task</label>
                <select
                  value={newDependency.taskId}
                  onChange={(e) =>
                    setNewDependency((prev) => ({ ...prev, taskId: e.target.value }))
                  }
                  className="form-select-primary"
                >
                  <option value="">Select a task...</option>
                  {availableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.slug} - {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label-primary mb-2">Dependency Type</label>
                <select
                  value={newDependency.type}
                  onChange={(e) =>
                    setNewDependency((prev) => ({
                      ...prev,
                      type: e.target.value as DependencyType,
                    }))
                  }
                  className="form-select-primary"
                >
                  {Object.values(DependencyType).map((type) => (
                    <option key={type} value={type}>
                      {getDependencyTypeIcon(type)} {type.replace("_", " ")}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {getDependencyTypeDescription(newDependency.type)}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="secondary" onClick={() => setShowAddDependency(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDependency} disabled={!newDependency.taskId}>
                Add Dependency
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Dependency Confirmation */}
      {dependencyToRemove && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setDependencyToRemove(null)}
          onConfirm={() => handleRemoveDependency(dependencyToRemove)}
          title="Remove Dependency"
          message="Are you sure you want to remove this dependency? This action cannot be undone."
          confirmText="Remove"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  );
}
