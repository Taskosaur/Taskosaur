import moment from "moment";
import { Task, ColumnConfig } from "@/types";

function extractTaskValueForCSV(task: Task, columnId: string): string {
  switch (columnId) {
    case "description":
      return task.description || "";

    case "taskNumber":
      return task.taskNumber?.toString() || "";

    case "timeline":
      if (task.startDate && task.dueDate) {
        return `${moment(task.startDate).format("MMM D, YYYY")} - ${moment(task.dueDate).format("MMM D, YYYY")}`;
      } else if (task.startDate) {
        return `${moment(task.startDate).format("MMM D, YYYY")} - TBD`;
      } else if (task.dueDate) {
        return `TBD - ${moment(task.dueDate).format("MMM D, YYYY")}`;
      }
      return "-";

    case "completedAt":
      return task.completedAt ? moment(task.completedAt).format("MMM D, YYYY") : "";

    case "storyPoints":
      return task.storyPoints?.toString() || "0";

    case "originalEstimate":
      return task.originalEstimate?.toString() || "0";

    case "remainingEstimate":
      return task.remainingEstimate?.toString() || "0";

    case "reporter":
      return task.reporter
        ? `${task.reporter.firstName} ${task.reporter.lastName}`.trim()
        : "";

    case "createdBy":
      return task.createdBy || "";

    case "createdAt":
      return task.createdAt ? moment(task.createdAt).format("MMM D, YYYY") : "";

    case "updatedAt":
      return task.updatedAt ? moment(task.updatedAt).format("MMM D, YYYY") : "";

    case "sprint":
      return task.sprint ? task.sprint.name : "";

    case "parentTask":
      return task.parentTask ? task.parentTask.title || task.parentTask.taskNumber?.toString() || "" : "";

    case "childTasksCount":
      return (task._count?.childTasks || task.childTasks?.length || 0).toString();

    case "commentsCount":
      return (task._count?.comments || task.comments?.length || 0).toString();

    case "attachmentsCount":
      return (task._count?.attachments || task.attachments?.length || 0).toString();

    case "timeEntries":
      return (task.timeEntries?.length || 0).toString();

    case "title":
      return task.title || "";

    case "project":
      return task.project?.name || "";

    case "dueDate":
        return task.dueDate ? moment(task.dueDate).format("MMM D, YYYY") : "-";

    default:
        const val = (task as any)[columnId];
        if (typeof val === 'string' || typeof val === 'number') {
            return val.toString();
        }
        if (columnId === 'status' && task.status) {
            return task.status.name;
        }
        if (columnId === 'priority' && task.priority) {
            return task.priority;
        }
        if (columnId === 'assignees') {
             if (task.assignees && task.assignees.length > 0) {
                return task.assignees.map(u => `${u.firstName} ${u.lastName}`.trim()).join(", ");
             }
             return "Unassigned";
        }
      return "";
  }
}

export const exportTasksToCSV = (
  tasks: Task[], 
  columns: ColumnConfig[], 
  filename = "tasks_export.csv",
  options: { showProject?: boolean } = {}
) => {
  const { showProject = false } = options;

  const defaultColumns: ColumnConfig[] = [
    { id: "title", label: "Task", visible: true },
    ...(showProject ? [{ id: "project", label: "Project", visible: true }] : []),
    { id: "priority", label: "Priority", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "assignees", label: "Assignees", visible: true },
    { id: "dueDate", label: "Due Date", visible: true },
  ];

  // Combine default columns with visible dynamic columns
  const visibleDynamicColumns = columns.filter((col) => col.visible);
  const allExportColumns = [...defaultColumns, ...visibleDynamicColumns];

  if (allExportColumns.length === 0) {
    console.warn("No visible columns to export");
    return;
  }
  
  // Create header row
  const headers = allExportColumns.map((col) => col.label);
  
  // Create data rows
  const rows = tasks.map((task) =>
    allExportColumns.map((col) => {
      let cellValue = extractTaskValueForCSV(task, col.id);
      
      // Escape generic CSV characters (quotes, commas, newlines)
      if (typeof cellValue === 'string') {
          cellValue = cellValue.replace(/"/g, '""'); // Escape double quotes
          if (cellValue.search(/("|,|\n)/g) >= 0) {
              cellValue = `"${cellValue}"`;
          }
      }
      return cellValue;
    })
  );

  // Combine header and rows
  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  // Trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
