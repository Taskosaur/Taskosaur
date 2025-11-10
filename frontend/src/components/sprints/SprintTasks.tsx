import React, { useState, useEffect } from "react";
import { useTask } from "@/contexts/task-context";
import { Button } from "@/components/ui/button";
import { HiClipboardDocumentList } from "react-icons/hi2";
import { HiX } from "react-icons/hi";
import TaskTable from "@/components/ui/tables/TaskTable";
import type { Task } from "@/types/tasks";
import { getCurrentOrganizationId } from "@/utils/hierarchyContext";
import Loader from "../common/Loader";
interface SprintTasksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sprintName?: string;
  sprintId?: string;
}

export const SprintTasksPanel: React.FC<SprintTasksPanelProps> = ({
  isOpen,
  onClose,
  sprintName = "Authentication & User Management",
  sprintId,
}) => {
  const { getTasksBySprint } = useTask();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const handleTaskSelect = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  useEffect(() => {
    const fetchTasks = async () => {
      if (!sprintId) return;
      setLoading(true);
      setError(null);
      try {
        const organizationId = getCurrentOrganizationId();
        if (!organizationId) {
          throw new Error("No organization selected. Please select an organization first.");
        }
        const result = await getTasksBySprint(organizationId, sprintId);
        const mapped = (result || []).map((task: any) => ({
          ...task,
          key: task.key || task.id,
          slug: task.slug || "",
          createdBy: task.createdBy || "",
          updatedBy: task.updatedBy || "",
          project: task.project || { id: task.projectId, name: "", slug: "" },
          assignee: task.assignee || null,
          reporter: task.reporter || {
            id: "",
            firstName: "",
            lastName: "",
            avatar: "",
          },
          status: task.status || {
            id: "",
            name: "",
            color: "",
            category: "TODO",
          },
        }));
        setTasks(mapped);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch tasks");
      } finally {
        setLoading(false);
      }
    };
    if (isOpen && sprintId) {
      fetchTasks();
    }
  }, [isOpen, sprintId]);

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} />
      <div className="sprints-tasks-modal-container">
        <div className="sprints-tasks-modal-content">
          <div className="sprints-tasks-header">
            <div className="sprints-tasks-header-info">
              <div className="sprints-tasks-header-icon">
                <HiClipboardDocumentList className="sprints-tasks-header-icon-inner" />
              </div>
              <div>
                <h2 className="sprints-tasks-header-title">Sprint Tasks</h2>
                <p className="sprints-tasks-header-subtitle">
                  {sprintName} • {tasks.length} tasks
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="sprints-tasks-close-button"
            >
              <HiX className="sprints-tasks-close-icon" />
            </Button>
          </div>

          <div className="sprints-tasks-content">
            {loading ? (
              <Loader />
            ) : error ? (
              <div className="sprints-tasks-error">{error}</div>
            ) : (
              <TaskTable
                tasks={tasks}
                selectedTasks={selectedTasks}
                onTaskSelect={handleTaskSelect}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
