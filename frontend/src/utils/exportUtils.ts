import moment from "moment";
import { Task, ColumnConfig } from "@/types";
import * as XLSX from "xlsx";

/**
 * Helper function to get columns for export
 */
function getExportColumns(
  columns: ColumnConfig[],
  options: { showProject?: boolean } = {}
): ColumnConfig[] {
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
  }

  return allExportColumns;
}

/**
 * Helper function to extract task data for export
 */
function extractTaskData(task: Task, columnId: string): any {
  switch (columnId) {
    case "description":
      return task.description || "";

    case "taskNumber":
      return task.taskNumber || null;

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
      return task.completedAt ? moment(task.completedAt).format("MMM D, YYYY") : null;

    case "storyPoints":
      return task.storyPoints || 0;

    case "originalEstimate":
      return task.originalEstimate || 0;

    case "remainingEstimate":
      return task.remainingEstimate || 0;

    case "reporter":
      return task.reporter
        ? `${task.reporter.firstName} ${task.reporter.lastName}`.trim()
        : "";

    case "createdBy":
      return task.createdBy || "";

    case "createdAt":
      return task.createdAt ? moment(task.createdAt).format("MMM D, YYYY") : null;

    case "updatedAt":
      return task.updatedAt ? moment(task.updatedAt).format("MMM D, YYYY") : null;

    case "sprint":
      return task.sprint ? task.sprint.name : "";

    case "parentTask":
      return task.parentTask ? task.parentTask.title || task.parentTask.taskNumber?.toString() || "" : "";

    case "childTasksCount":
      return task._count?.childTasks || task.childTasks?.length || 0;

    case "commentsCount":
      return task._count?.comments || task.comments?.length || 0;

    case "attachmentsCount":
      return task._count?.attachments || task.attachments?.length || 0;

    case "timeEntries":
      return task.timeEntries?.length || 0;

    case "title":
      return task.title || "";

    case "project":
      return task.project?.name || "";

    case "dueDate":
      return task.dueDate ? moment(task.dueDate).format("YYYY-MM-DD") : null;

    case "startDate":
      return task.startDate ? moment(task.startDate).format("YYYY-MM-DD") : null;

    default:
      const val = (task as any)[columnId];
      if (typeof val === 'string' || typeof val === 'number' || val === null) {
        return val;
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
  try {
    const allExportColumns = getExportColumns(columns, options);

    if (allExportColumns.length === 0) {
      return;
    }

    // Create header row
    const headers = allExportColumns.map((col) => col.label);

    // Create data rows
    const rows = tasks.map((task) =>
      allExportColumns.map((col) => {
        const cellValue = extractTaskData(task, col.id);

        // Convert to string and escape CSV characters
        const stringValue = cellValue === null || cellValue === undefined ? "" : String(cellValue);
        const escapedValue = stringValue.replace(/"/g, '""');
        
        if (escapedValue.search(/("|,|\n)/g) >= 0) {
          return `"${escapedValue}"`;
        }
        return escapedValue;
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

    try {
      link.click();
    } finally {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("Failed to export tasks to CSV:", error);
    alert("Failed to export tasks. Please try again.");
  }
};

/**
 * Export tasks to Excel (.xlsx) format
 */
export const exportTasksToXLSX = (
  tasks: Task[],
  columns: ColumnConfig[],
  filename = "tasks_export.xlsx",
  options: { showProject?: boolean } = {}
) => {
  try {
    const allExportColumns = getExportColumns(columns, options);

    if (allExportColumns.length === 0) {
      return;
    }

    // Create header row
    const headers = allExportColumns.map((col) => col.label);

    // Create data rows
    const rows = tasks.map((task) =>
      allExportColumns.map((col) => extractTaskData(task, col.id))
    );

    // Combine header and rows
    const data = [headers, ...rows];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths (auto-size based on content)
    const colWidths = allExportColumns.map((col, index) => {
      const maxWidth = 30;
      const headerWidth = col.label.length;
      const maxDataWidth = Math.min(
        maxWidth,
        Math.max(
          ...tasks.map((task) => {
            const value = extractTaskData(task, col.id);
            return value ? String(value).length : 0;
          })
        )
      );
      return { wch: Math.max(headerWidth, maxDataWidth, 10) };
    });
    worksheet["!cols"] = colWidths;

    // Style header row (bold)
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "E0E0E0" } },
        alignment: { horizontal: "left", vertical: "center" },
      };
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

    // Generate and download
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error("Failed to export tasks to XLSX:", error);
    alert("Failed to export tasks to Excel. Please try again.");
  }
};

/**
 * Export tasks to JSON format
 */
export const exportTasksToJSON = (
  tasks: Task[],
  columns: ColumnConfig[],
  filename = "tasks_export.json",
  options: { showProject?: boolean; pretty?: boolean } = {}
) => {
  try {
    const { pretty = true } = options;
    const allExportColumns = getExportColumns(columns, options);

    if (allExportColumns.length === 0) {
      return;
    }

    // Create export data with structured format
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      columns: allExportColumns.map((col) => col.label),
      tasks: tasks.map((task) => {
        const taskData: Record<string, any> = {};
        allExportColumns.forEach((col) => {
          taskData[col.label] = extractTaskData(task, col.id);
        });
        return taskData;
      }),
    };

    // Convert to JSON string
    const jsonString = pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    // Trigger download
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);

    try {
      link.click();
    } finally {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("Failed to export tasks to JSON:", error);
    alert("Failed to export tasks to JSON. Please try again.");
  }
};

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const exportTasksToPDF = (
  tasks: Task[],
  columns: ColumnConfig[],
  filename = "tasks_export.pdf",
  options: { showProject?: boolean } = {}
) => {
  try {
    const { showProject = false } = options;
    const safeFilename = filename.replace(/[^\w.\- ]+/g, "_");

    const defaultColumns: ColumnConfig[] = [
      { id: "title", label: "Task", visible: true },
      ...(showProject ? [{ id: "project", label: "Project", visible: true }] : []),
      { id: "priority", label: "Priority", visible: true },
      { id: "status", label: "Status", visible: true },
      { id: "assignees", label: "Assignees", visible: true },
      { id: "dueDate", label: "Due Date", visible: true },
    ];

    const visibleDynamicColumns = columns.filter((col) => col.visible);
    const allExportColumns = [...defaultColumns, ...visibleDynamicColumns];

    if (allExportColumns.length === 0) {
      console.warn("No visible columns to export");
      return;
    }

    // Create a simple HTML table for printing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${safeFilename}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f4f4f4; }
          h1 { font-size: 18px; }
          @media print {
            @page { margin: 1cm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Tasks Export - ${new Date().toLocaleDateString()}</h1>
        <table>
          <thead>
            <tr>
              ${allExportColumns.map(col => `<th>${escapeHtml(col.label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tasks.map(task => `
              <tr>
                ${allExportColumns.map(col => `<td>${escapeHtml(String(extractTaskData(task, col.id)))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>
          window.onload = () => {
            window.print();
            // Optional: window.close();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      try {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } catch (error) {
        console.error("Failed to write PDF content:", error);
        alert("Failed to generate PDF. Please try again.");
      }
    } else {
      alert("Please allow popups to export as PDF");
    }
  } catch (error) {
    console.error("Failed to export tasks to PDF:", error);
    alert("Failed to export tasks to PDF. Please try again.");
  }
};
