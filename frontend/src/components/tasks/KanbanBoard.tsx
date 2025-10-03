import React, { useState } from "react";
import { useTask } from "@/contexts/task-context";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import StatusColumn from "../kanban/StatusColumn";
import StatusSettingsModal from "../kanban/StatusSettingsModal";
import TaskDetailClient from "./TaskDetailClient";
import { Task } from "@/types";
import { CustomModal } from "../common/CustomeModal";
interface TasksByStatus {
  statusId: string;
  statusName: string;
  statusColor: string;
  statusCategory: "TODO" | "IN_PROGRESS" | "DONE";
  tasks: KanbanTask[];
  _count: number;
}

interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  taskNumber: number;
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  reporter: {
    id: string;
    firstName: string;
    lastName: string;
  };
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
  isLoading?: boolean;
  kabBanSettingModal?: boolean;
  setKabBanSettingModal?: (open: boolean) => void;
  workspaceSlug?: string;
  projectSlug?: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  kanbanData,
  projectId,
  onTaskMove,
  onRefresh,
  isLoading = false,
  kabBanSettingModal,
  setKabBanSettingModal,
  workspaceSlug,
  projectSlug,
}) => {
  const { updateTaskStatus, createTask, getTaskById, currentTask } = useTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop({
    onDrop: async (
      task: KanbanTask,
      fromStatusId: string,
      toStatusId: string
    ) => {
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
        dueDate: data.dueDate
          ? new Date(data.dueDate + "T17:00:00.000Z").toISOString()
          : undefined,
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
    await getTaskById(task.id);
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };
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
      <div className="flex flex-nowrap gap-4 overflow-x-auto">
        {kanbanData.map((status) => (
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
          onClose={() => setIsEditModalOpen(false)}
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
              onClose={() => setIsEditModalOpen(false)}
            />
          )}
        </CustomModal>
      )}
    </>
  );
};

export { KanbanBoard };
