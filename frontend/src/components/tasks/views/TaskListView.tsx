import { useState } from "react";
import TaskTable from "@/components/ui/tables/TaskTable";
import { ColumnConfig, Task } from "@/types";

interface TaskListViewProps {
  tasks: Task[];
  workspaceSlug?: string;
  projectSlug?: string;
  projects?: any[];
  projectsOfCurrentWorkspace?: any[];
  onTaskRefetch?: () => void;
  columns?: ColumnConfig[];
  showAddTaskRow?: boolean;
  addTaskPriorities?: any[];
  addTaskStatuses?: any[];
  projectMembers?: any[];
  workspaceMembers?: any[];
  selectedTasks?: string[];
  onTaskSelect?: (taskId: string) => void;
  showBulkActionBar?: boolean;
  totalTask?: number;
}

export default function TaskListView({
  tasks,
  workspaceSlug,
  projectSlug,
  projects,
  projectsOfCurrentWorkspace,
  onTaskRefetch,
  columns,
  showAddTaskRow,

  addTaskStatuses,
  projectMembers,
  workspaceMembers,
  selectedTasks: externalSelectedTasks,
  onTaskSelect: externalOnTaskSelect,
  showBulkActionBar,
  totalTask,
}: TaskListViewProps) {
  const [internalSelectedTasks, setInternalSelectedTasks] = useState<string[]>([]);
  const selectedTasks = externalSelectedTasks ?? internalSelectedTasks;
  const handleTaskSelect =
    externalOnTaskSelect ??
    ((taskId: string) => {
      setInternalSelectedTasks((prev) =>
        prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
      );
    });

  return (
    <div className="rounded-md">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground"></div>
      </div>
      <TaskTable
        tasks={tasks}
        workspaceSlug={workspaceSlug}
        projectSlug={projectSlug}
        projects={projects}
        projectsOfCurrentWorkspace={projectsOfCurrentWorkspace}
        showProject={!projectSlug}
        columns={columns}
        onTaskRefetch={onTaskRefetch}
        showAddTaskRow={showAddTaskRow}
        addTaskStatuses={addTaskStatuses}
        projectMembers={projectMembers}
        workspaceMembers={workspaceMembers}
        selectedTasks={selectedTasks}
        onTaskSelect={handleTaskSelect}
        showBulkActionBar={showBulkActionBar}
        totalTask={totalTask}
      />
    </div>
  );
}
