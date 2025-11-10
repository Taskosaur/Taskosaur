import { useState } from "react";
import { Task, TaskStatus } from "@/types";
import TaskCard from "./TaskCard";

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  allTasks?: Task[];
  onTaskMove: (taskId: string, newStatusId: string) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  onDrop: (statusId: string) => void;
  draggedTask: Task | null;
}

export default function TaskColumn({
  status,
  tasks,
  allTasks = [],
  onDragStart,
  onDragEnd,
  onDrop,
  draggedTask,
}: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(status.id);
  };

  return (
    <div
      className={`flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-800 rounded-lg ${
        isDragOver
          ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-600"
          : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: status.color }} />
            <h3 className="font-semibold text-gray-900 dark:text-white">{status.name}</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
              {tasks.length}
            </span>
          </div>

          {/* Column Actions */}
          <div className="flex items-center space-x-1">
            <button
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="Column settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        {status.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{status.description}</p>
        )}
      </div>

      {/* Tasks */}
      <div
        className={`p-4 space-y-3 min-h-[400px] ${isDragOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
      >
        {tasks.length === 0 ? (
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
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              No tasks in {status.name.toLowerCase()}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              allTasks={allTasks}
              onDragStart={() => onDragStart(task)}
              onDragEnd={onDragEnd}
              isDragging={draggedTask?.id === task.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
