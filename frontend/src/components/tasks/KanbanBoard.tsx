import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTask } from "@/contexts/task-context";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import StatusColumn from "../kanban/StatusColumn";
import StatusSettingsModal from "../kanban/StatusSettingsModal";
import TaskDetailClient from "./TaskDetailClient";
import { Task } from "@/types";
import { CustomModal } from "../common/CustomeModal";
import { useAuth } from "@/contexts/auth-context";

interface TaskPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface TasksByStatus {
  statusId: string;
  statusName: string;
  statusColor: string;
  statusCategory: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  tasks: KanbanTask[];
  pagination: TaskPagination;
}

interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  taskNumber: number;
  assignees?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;
  reporters?: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  subtaskCount?: number;
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

interface KanbanBoardProps {
  kanbanData: TasksByStatus[];
  projectId: string;
  onTaskMove?: (taskId: string, newStatusId: string) => void;
  onRefresh?: () => void;
  onLoadMore?: (statusId: string, page: number) => Promise<void>;
  isLoading?: boolean;
  kabBanSettingModal?: boolean;
  setKabBanSettingModal?: (open: boolean) => void;
  workspaceSlug?: string;
  projectSlug?: string;
  onKanbanUpdate?: (updatedKanban: TasksByStatus[]) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  kanbanData,
  projectId,
  onTaskMove,
  onRefresh,
  onLoadMore,
  isLoading = false,
  kabBanSettingModal,
  setKabBanSettingModal,
  workspaceSlug,
  projectSlug,
  onKanbanUpdate,
}) => {
  const { updateTaskStatus, createTask, getTaskById, currentTask } = useTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [localKanbanData, setLocalKanbanData] = useState<TasksByStatus[]>(kanbanData);

  const [loadingStatuses, setLoadingStatuses] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalKanbanData(kanbanData);
  }, [kanbanData]);

  useEffect(() => {
    if (!currentTask || !isEditModalOpen) return;

    setLocalKanbanData((prevData) => {
      const updatedData = prevData.map((statusColumn) => ({
        ...statusColumn,
        tasks: statusColumn.tasks.map((task) =>
          task.id === currentTask.id
            ? {
                ...task,
                title: currentTask.title,
                description: currentTask.description,
                priority: currentTask.priority as any,
                dueDate: currentTask.dueDate,
                assignees: currentTask.assignees,
                reporters: currentTask.reporters,
                labels: (currentTask as any).labels || (currentTask as any).tags || task.labels,
                updatedAt: currentTask.updatedAt,
              }
            : task
        ),
      }));

      if (onKanbanUpdate) {
        onKanbanUpdate(updatedData);
      }

      return updatedData;
    });
  }, [currentTask, isEditModalOpen, onKanbanUpdate]);

  const { dragState, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragAndDrop({
    onDrop: async (task: KanbanTask, fromStatusId: string, toStatusId: string) => {
      try {
        await updateTaskStatus(task.id, toStatusId);
        onTaskMove?.(task.id, toStatusId);
        onRefresh?.();
      } catch (err) {
        console.error("Failed to move task:", err);
      }
    },
  });

  const handleCreateTask = async (
    statusId: string,
    data: {
      title: string;
      dueDate: string;
      reporterId: string;
    }
  ) => {
    try {
      await createTask({
        title: data.title.trim(),
        projectId: projectId,
        statusId,
        reporterIds: data.reporterId ? [data.reporterId] : [],
        dueDate: data.dueDate ? new Date(data.dueDate + "T17:00:00.000Z").toISOString() : undefined,
      });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  const handleStatusUpdated = () => {
    onRefresh?.();
  };

  const handleRowClick = async (task: Task) => {
    await getTaskById(task.id, isAuthenticated());
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };

  const handleTaskRefetch = useCallback(() => {
    // Close the modal first
    setIsEditModalOpen(false);
    setSelectedTask(null);

    onRefresh?.();
  }, [onRefresh]);

  // Handle scroll-based pagination for individual columns
  const handleColumnScroll = useCallback(
    async (statusId: string, currentPage: number) => {
      if (!onLoadMore || loadingStatuses.has(statusId)) return;

      const status = localKanbanData.find((s) => s.statusId === statusId);
      if (!status?.pagination.hasNextPage) return;

      try {
        setLoadingStatuses((prev) => new Set(prev).add(statusId));
        await onLoadMore(statusId, currentPage + 1);
      } catch (error) {
        console.error(`Failed to load more tasks for status ${statusId}:`, error);
      } finally {
        setLoadingStatuses((prev) => {
          const newSet = new Set(prev);
          newSet.delete(statusId);
          return newSet;
        });
      }
    },
    [localKanbanData, onLoadMore, loadingStatuses]
  );

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-80 bg-[var(--muted)]/30 rounded-lg p-4 animate-pulse"
          >
            <div className="h-6 bg-[var(--muted)] rounded mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((__, j) => (
                <div key={j} className="h-20 bg-[var(--muted)] rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4">
        {localKanbanData.map((status) => (
          <StatusColumn
            key={status.statusId}
            status={status}
            projectId={projectId}
            dragState={dragState}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onTaskDragStart={handleDragStart}
            onTaskDragEnd={handleDragEnd}
            onCreateTask={handleCreateTask}
            onTaskClick={handleRowClick}
            onLoadMore={handleColumnScroll}
            isLoadingMore={loadingStatuses.has(status.statusId)}
          />
        ))}
      </div>

      <StatusSettingsModal
        isOpen={kabBanSettingModal}
        onClose={() => setKabBanSettingModal(false)}
        projectId={projectId}
        onStatusUpdated={handleStatusUpdated}
      />

      {isEditModalOpen && (
        <CustomModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTask(null);
          }}
          animation="slide-right"
          height="h-screen"
          top="top-4"
          zIndex="z-50"
          width="w-full md:w-[80%] lg:w-[60%]"
          position="items-start justify-end"
          closeOnOverlayClick={true}
        >
          {selectedTask && (
            <TaskDetailClient
              task={currentTask}
              open="modal"
              workspaceSlug={workspaceSlug as string}
              projectSlug={projectSlug as string}
              taskId={selectedTask.id}
              onClose={() => {
                setIsEditModalOpen(false);
                setSelectedTask(null);
              }}
              onTaskRefetch={handleTaskRefetch}
            />
          )}
        </CustomModal>
      )}
    </>
  );
};

export { KanbanBoard };
