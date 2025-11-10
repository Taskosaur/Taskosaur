import { useState } from "react";
import { Task, TaskType, TaskPriority } from "@/types/tasks";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import TaskDetailModal from "./TaskDetailModal";
import { HiEnvelope } from "react-icons/hi2";

interface TaskCardProps {
  task: Task;
  allTasks?: Task[];
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export default function TaskCard({
  task,
  allTasks = [],
  onDragStart,
  onDragEnd,
  isDragging,
}: TaskCardProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);

  const getTypeIcon = (type: TaskType) => {
    switch (type) {
      case TaskType.BUG:
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,12H10V10H14M14,16H10V14H14M20,8H17.19C16.74,7.22 16.12,6.55 15.37,6.04L17,4.41L15.59,3L13.42,5.17C12.96,5.06 12.5,5 12,5C11.5,5 11.04,5.06 10.59,5.17L8.41,3L7,4.41L8.62,6.04C7.88,6.55 7.26,7.22 6.81,8H4V10H6.09C6.04,10.33 6,10.66 6,11V12H4V14H6V15C6,15.34 6.04,15.67 6.09,16H4V18H6.81C7.85,19.79 9.78,21 12,21C14.22,21 16.15,19.79 17.19,18H20V16H17.91C17.96,15.67 18,15.34 18,15V14H20V12H18V11C18,10.66 17.96,10.33 17.91,10H20V8Z" />
          </svg>
        );
      case TaskType.STORY:
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V16H6V18H15M18,14V12H6V14H18Z" />
          </svg>
        );
      case TaskType.EPIC:
        return (
          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,7H13V9H11V7M11,11H13V17H11V11Z" />
          </svg>
        );
      case TaskType.SUBTASK:
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        );
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
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

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case "HIGHEST":
        return "🔴";
      case "HIGH":
        return "🟠";
      case "MEDIUM":
        return "🟡";
      case "LOW":
        return "🟢";
      case "LOWEST":
        return "⚪";
      default:
        return "⚪";
    }
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `${Math.abs(diffDays)} days overdue`,
        color: "text-red-600",
        bgColor: "bg-red-100 dark:bg-red-900/20",
      };
    } else if (diffDays === 0) {
      return {
        text: "Due today",
        color: "text-orange-600",
        bgColor: "bg-orange-100 dark:bg-orange-900/20",
      };
    } else if (diffDays === 1) {
      return {
        text: "Due tomorrow",
        color: "text-yellow-600",
        bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
      };
    } else if (diffDays <= 7) {
      return {
        text: `Due in ${diffDays} days`,
        color: "text-yellow-600",
        bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
      };
    } else {
      return {
        text: date.toLocaleDateString(),
        color: "text-gray-600",
        bgColor: "bg-gray-100 dark:bg-gray-900/20",
      };
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    onDragStart();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.detail === 2) {
      setShowDetailModal(true);
    }
  };

  return (
    <>
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-move transition-all duration-200 hover:shadow-md group ${
          isDragging ? "opacity-50 rotate-2" : ""
        }`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onClick={handleClick}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {getTypeIcon(task.type)}
            {/* Email indicator */}
            {task.inboxMessageId && (
              <div className="flex items-center space-x-1" title="Created from email">
                <HiEnvelope className="w-3 h-3 text-blue-500" />
                <span className="text-xs text-blue-600 bg-blue-100 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                  Email
                </span>
              </div>
            )}
            {/* Email replies enabled indicator */}
            {task.allowEmailReplies && (
              <div className="flex items-center" title="Email replies enabled">
                <HiEnvelope className="w-3 h-3 text-green-500" />
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
              {getPriorityIcon(task.priority)}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailModal(true);
              }}
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

        {/* Title */}
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 leading-tight">
          {task.title}
        </h4>

        {/* Description Preview */}
        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Due Date */}
        {task.dueDate && (
          <div className="mb-3">
            {(() => {
              const dueDateInfo = formatDueDate(task.dueDate);
              return (
                <span
                  className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${dueDateInfo.bgColor} ${dueDateInfo.color}`}
                >
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {dueDateInfo.text}
                </span>
              );
            })()}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            {/* Story Points */}
            {task.storyPoints && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {task.storyPoints} SP
              </span>
            )}

            {/* Subtasks count */}
            {task.childTasks && task.childTasks.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {task.childTasks.length} subtasks
              </span>
            )}

            {/* Comments count */}
            {task.comments && task.comments.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {task.comments.length}
              </span>
            )}

            {/* Attachments count */}
            {task.attachments && task.attachments.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                {task.attachments.length}
              </span>
            )}
          </div>

          {/* Assignee */}
          <div className="flex items-center space-x-2">
            {task.assignee && <UserAvatar user={task.assignee} size="xs" />}
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      {showDetailModal && (
        <TaskDetailModal
          task={task}
          allTasks={allTasks}
          onClose={() => setShowDetailModal(false)}
          onUpdate={() => {}}
        />
      )}
    </>
  );
}
