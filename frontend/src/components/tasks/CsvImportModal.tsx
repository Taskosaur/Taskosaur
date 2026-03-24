import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Upload, X, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import ActionButton from "@/components/common/ActionButton";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useProjectContext } from "@/contexts/project-context";
import { getCurrentOrganizationId } from "@/utils/hierarchyContext";
import { formatDateForApi } from "@/utils/handleDateChange";
import { taskApi } from "@/utils/api/taskApi";
import { sprintApi } from "@/utils/api/sprintApi";

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete?: () => Promise<void>;
    workspaceId?: string;
    workspaceName?: string;
    projectId?: string;
    projectName?: string;
    projectSlug?: string;
    sprintId?: string;
    sprintName?: string;
}

interface ParsedTask {
    title: string;
    description?: string;
    priority?: string;
    type?: string;
    dueDate?: string;
}

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "HIGHEST"];
const VALID_TYPES = ["TASK", "BUG", "STORY", "EPIC"];

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    return { headers, rows };
}

function mapRowToTask(headers: string[], row: string[]): ParsedTask | null {
    const get = (key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 && idx < row.length ? row[idx].trim() : "";
    };

    const title = get("title") || get("name") || get("task") || get("summary");
    if (!title) return null;

    const rawPriority = (get("priority") || "MEDIUM").toUpperCase();
    const priority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : "MEDIUM";

    const rawType = (get("type") || "TASK").toUpperCase();
    const type = VALID_TYPES.includes(rawType) ? rawType : "TASK";

    const dueDate = get("duedate") || get("due_date") || get("due date") || "";

    return {
        title,
        description: get("description") || undefined,
        priority,
        type,
        dueDate: dueDate || undefined,
    };
}

export function CsvImportModal({
    isOpen,
    onClose,
    onImportComplete,
    workspaceId: prefilledWorkspaceId,
    workspaceName: prefilledWorkspaceName,
    projectId: prefilledProjectId,
    projectName: prefilledProjectName,
    projectSlug: prefilledProjectSlug,
    sprintId: prefilledSprintId,
    sprintName: prefilledSprintName,
}: CsvImportModalProps) {
    const { t } = useTranslation("tasks");
    const { getWorkspacesByOrganization } = useWorkspaceContext();
    const { getProjectsByWorkspace, getTaskStatusByProject } = useProjectContext();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Context state
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(prefilledWorkspaceId || "");
    const [selectedProjectId, setSelectedProjectId] = useState(prefilledProjectId || "");
    const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
    const [loadingProjects, setLoadingProjects] = useState(false);

    // Sprint state
    const [sprints, setSprints] = useState<any[]>([]);
    const [selectedSprintId, setSelectedSprintId] = useState(prefilledSprintId || "");
    const [loadingSprints, setLoadingSprints] = useState(false);

    // File state
    const [file, setFile] = useState<File | null>(null);
    const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);

    // Import state
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ done: 0, total: 0, failed: 0 });
    const [importDone, setImportDone] = useState(false);

    const needsWorkspace = !prefilledWorkspaceId;
    const needsProject = !prefilledProjectId;

    // Load workspaces if needed
    useEffect(() => {
        if (!isOpen || !needsWorkspace) return;
        const orgId = getCurrentOrganizationId();
        if (!orgId) return;

        setLoadingWorkspaces(true);
        getWorkspacesByOrganization(orgId)
            .then((data) => setWorkspaces(data || []))
            .catch(() => setWorkspaces([]))
            .finally(() => setLoadingWorkspaces(false));
    }, [isOpen, needsWorkspace]);

    // Load projects when workspace selected
    useEffect(() => {
        const wsId = prefilledWorkspaceId || selectedWorkspaceId;
        if (!isOpen || !wsId || !needsProject) return;

        setLoadingProjects(true);
        getProjectsByWorkspace(wsId)
            .then((data) => setProjects(data || []))
            .catch(() => setProjects([]))
            .finally(() => setLoadingProjects(false));
    }, [isOpen, selectedWorkspaceId, prefilledWorkspaceId, needsProject]);

    // Load sprints when project is selected
    useEffect(() => {
        const projId = prefilledProjectId || selectedProjectId;
        if (!isOpen || !projId) {
            setSprints([]);
            setSelectedSprintId("");
            return;
        }

        const selectedProject = projects.find((p) => p.id === projId);
        const projectSlug = selectedProject?.slug || prefilledProjectSlug;
        if (!projectSlug) return;

        setLoadingSprints(true);
        sprintApi.getSprintsByProject(projectSlug, true)
            .then((data) => {
                setSprints(data || []);
                const activeSprint = data?.find((s: any) => s.status === "ACTIVE");
                const defaultSprint = data?.find((s: any) => s.isDefault);
                if (prefilledSprintId && data?.some((s: any) => s.id === prefilledSprintId)) {
                    setSelectedSprintId(prefilledSprintId);
                } else if (activeSprint) {
                    setSelectedSprintId(activeSprint.id);
                } else if (defaultSprint) {
                    setSelectedSprintId(defaultSprint.id);
                }
            })
            .catch(() => setSprints([]))
            .finally(() => setLoadingSprints(false));
    }, [isOpen, selectedProjectId, prefilledProjectId, prefilledProjectSlug, projects]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setFile(null);
            setParsedTasks([]);
            setParseError(null);
            setIsImporting(false);
            setImportDone(false);
            setImportProgress({ done: 0, total: 0, failed: 0 });
            if (!prefilledWorkspaceId) setSelectedWorkspaceId("");
            if (!prefilledProjectId) setSelectedProjectId("");
            setSelectedSprintId(prefilledSprintId || "");
            setSprints([]);
        }
    }, [isOpen]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!selected.name.endsWith(".csv")) {
            setParseError("Please select a CSV file");
            return;
        }

        setFile(selected);
        setParseError(null);
        setParsedTasks([]);

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const { headers, rows } = parseCsv(text);

                if (!headers.includes("title") && !headers.includes("name") && !headers.includes("task") && !headers.includes("summary")) {
                    setParseError("CSV must have a 'title' column (or 'name', 'task', 'summary')");
                    return;
                }

                const tasks = rows
                    .map((row) => mapRowToTask(headers, row))
                    .filter(Boolean) as ParsedTask[];

                if (tasks.length === 0) {
                    setParseError("No valid tasks found in CSV");
                    return;
                }

                setParsedTasks(tasks);
            } catch {
                setParseError("Failed to parse CSV file");
            }
        };
        reader.readAsText(selected);
    }, []);

    const handleImport = useCallback(async () => {
        const projectId = prefilledProjectId || selectedProjectId;
        if (!projectId || parsedTasks.length === 0) return;

        setIsImporting(true);
        setImportProgress({ done: 0, total: parsedTasks.length, failed: 0 });

        let statuses: any[] = [];
        try {
            statuses = await getTaskStatusByProject(projectId);
        } catch {
            toast.error("Failed to load task statuses");
            setIsImporting(false);
            return;
        }

        const defaultStatus =
            statuses.find(
                (s: any) =>
                    s.name.toLowerCase() === "todo" ||
                    s.name.toLowerCase() === "to do" ||
                    s.isDefault
            ) || statuses[0];

        if (!defaultStatus) {
            toast.error("No task statuses found for this project");
            setIsImporting(false);
            return;
        }

        // Format tasks for bulk API
        const bulkTasks = parsedTasks.map((task) => {
            let formattedDueDate: string | undefined = undefined;
            if (task.dueDate) {
                const parsed = new Date(task.dueDate);
                if (!isNaN(parsed.getTime())) {
                    formattedDueDate = formatDateForApi(parsed.toISOString().split('T')[0]) ?? undefined;
                }
            }
            return {
                title: task.title,
                description: task.description || "",
                priority: task.priority || "MEDIUM",
                type: task.type || "TASK",
                dueDate: formattedDueDate,
            };
        });

        try {
            const result = await taskApi.bulkCreateTasks({
                projectId,
                statusId: defaultStatus.id,
                sprintId: selectedSprintId || undefined,
                tasks: bulkTasks,
            });

            setImportProgress({ done: result.created, total: parsedTasks.length, failed: result.failed });
            setImportDone(true);

            if (result.failed === 0) {
                toast.success(`Created ${result.created} tasks successfully`);
            } else {
                toast.warning(`Created ${result.created} tasks, ${result.failed} failed`);
            }

            if (onImportComplete) {
                try {
                    await onImportComplete();
                } catch { }
            }
        } catch (err) {
            toast.error("Failed to import tasks");
        } finally {
            setIsImporting(false);
        }
    }, [parsedTasks, selectedProjectId, prefilledProjectId, selectedSprintId, getTaskStatusByProject, onImportComplete]);

    const activeProjectId = prefilledProjectId || selectedProjectId;
    const canImport = parsedTasks.length > 0 && activeProjectId && !isImporting && !importDone;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="projects-modal-container border-none max-w-lg">
                <DialogHeader className="projects-modal-header">
                    <div className="projects-modal-header-content">
                        <div className="projects-modal-icon bg-[var(--primary)]">
                            <Upload className="projects-modal-icon-content w-5 h-5" />
                        </div>
                        <div className="projects-modal-info">
                            <DialogTitle className="projects-modal-title">Import Tasks from CSV</DialogTitle>
                            <DialogDescription className="projects-modal-description">
                                Upload a CSV file to create tasks in bulk
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="projects-modal-form space-y-4">
                    {/* Workspace selector (only if not pre-filled) */}
                    {needsWorkspace && (
                        <div className="projects-form-field">
                            <Label className="projects-form-label text-sm font-medium">
                                Workspace <span className="projects-form-label-required">*</span>
                            </Label>
                            <select
                                value={selectedWorkspaceId}
                                onChange={(e) => {
                                    setSelectedWorkspaceId(e.target.value);
                                    setSelectedProjectId("");
                                }}
                                disabled={loadingWorkspaces || isImporting}
                                className="w-full h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                            >
                                <option value="">{loadingWorkspaces ? "Loading..." : "Select workspace"}</option>
                                {workspaces.map((ws) => (
                                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Project selector (only if not pre-filled) */}
                    {needsProject && (
                        <div className="projects-form-field">
                            <Label className="projects-form-label text-sm font-medium">
                                Project <span className="projects-form-label-required">*</span>
                            </Label>
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                disabled={loadingProjects || isImporting || (!prefilledWorkspaceId && !selectedWorkspaceId)}
                                className="w-full h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                            >
                                <option value="">
                                    {loadingProjects
                                        ? "Loading..."
                                        : !prefilledWorkspaceId && !selectedWorkspaceId
                                            ? "Select workspace first"
                                            : "Select project"}
                                </option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Sprint selector */}
                    {(prefilledProjectId || selectedProjectId) && !prefilledSprintId && (
                        <div className="projects-form-field">
                            <Label className="projects-form-label text-sm font-medium">
                                Sprint
                            </Label>
                            <select
                                value={selectedSprintId}
                                onChange={(e) => setSelectedSprintId(e.target.value)}
                                disabled={loadingSprints || isImporting}
                                className="w-full h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                            >
                                <option value="">{loadingSprints ? "Loading..." : "Default sprint"}</option>
                                {sprints.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}{s.isDefault ? " (Default)" : ""}{s.status === "ACTIVE" ? " (Active)" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Show pre-filled context */}
                    {prefilledWorkspaceName && (
                        <div className="text-sm text-[var(--muted-foreground)]">
                            Workspace: <span className="font-medium text-[var(--foreground)]">{prefilledWorkspaceName}</span>
                        </div>
                    )}
                    {prefilledProjectName && (
                        <div className="text-sm text-[var(--muted-foreground)]">
                            Project: <span className="font-medium text-[var(--foreground)]">{prefilledProjectName}</span>
                        </div>
                    )}
                    {(prefilledSprintName || sprints.find(s => s.id === prefilledSprintId)?.name) && (
                        <div className="text-sm text-[var(--muted-foreground)]">
                            Sprint: <span className="font-medium text-[var(--foreground)]">{prefilledSprintName || sprints.find(s => s.id === prefilledSprintId)?.name}</span>
                        </div>
                    )}

                    {/* File upload */}
                    <div className="projects-form-field">
                        <Label className="projects-form-label text-sm font-medium">CSV File</Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isImporting}
                        />
                        <div
                            onClick={() => !isImporting && fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${file
                                ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                                : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--accent)]"
                                } ${isImporting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-2 text-sm">
                                    <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    <span className="font-medium">{file.name}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFile(null);
                                            setParsedTasks([]);
                                            setParseError(null);
                                            setImportDone(false);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                        className="ml-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Upload className="w-8 h-8 mx-auto text-[var(--muted-foreground)]" />
                                    <p className="text-sm text-[var(--muted-foreground)]">Click to upload CSV file</p>
                                    <p className="text-xs text-[var(--muted-foreground)]">
                                        Required column: title. Optional: description, priority, type, dueDate
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Parse error */}
                    {parseError && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                            <AlertCircle className="w-4 h-4" />
                            {parseError}
                        </div>
                    )}

                    {/* Preview */}
                    {parsedTasks.length > 0 && !importDone && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                Found {parsedTasks.length} task{parsedTasks.length > 1 ? "s" : ""} to import:
                            </p>
                            <div className="overflow-hidden border border-[var(--border)] rounded-md">
                                <table className="w-full text-xs table-fixed">
                                    <thead className="bg-[var(--accent)] sticky top-0">
                                        <tr>
                                            <th className="text-left p-2 font-medium w-8">#</th>
                                            <th className="text-left p-2 font-medium w-1/4">Title</th>
                                            <th className="text-left p-2 font-medium w-1/4">Description</th>
                                            <th className="text-left p-2 font-medium w-1/6">Priority</th>
                                            <th className="text-left p-2 font-medium w-1/6">Type</th>
                                            <th className="text-left p-2 font-medium w-1/6">Due Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedTasks.slice(0, 5).map((task, i) => (
                                            <tr key={i} className="border-t border-[var(--border)]">
                                                <td className="p-2 text-[var(--muted-foreground)]">{i + 1}</td>
                                                <td className="p-2">
                                                    <div className="truncate" title={task.title}>{task.title}</div>
                                                </td>
                                                <td className="p-2">
                                                    <div className="truncate" title={task.description}>{task.description || "-"}</div>
                                                </td>
                                                <td className="p-2">{task.priority || "MEDIUM"}</td>
                                                <td className="p-2">{task.type || "TASK"}</td>
                                                <td className="p-2 truncate">{task.dueDate || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {parsedTasks.length > 5 && (
                                <p className="text-xs text-[var(--muted-foreground)] text-right">
                                    Showing top 5 tasks out of {parsedTasks.length} total
                                </p>
                            )}
                        </div>
                    )}

                    {/* Progress */}
                    {isImporting && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Importing tasks...</span>
                                <span>{importProgress.done}/{importProgress.total}</span>
                            </div>
                            <div className="w-full bg-[var(--accent)] rounded-full h-2">
                                <div
                                    className="bg-[var(--primary)] h-2 rounded-full transition-all"
                                    style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                                />
                            </div>
                            {importProgress.failed > 0 && (
                                <p className="text-xs text-red-500">{importProgress.failed} failed</p>
                            )}
                        </div>
                    )}

                    {/* Done state */}
                    {importDone && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            Import complete! Created {importProgress.done - importProgress.failed} task{importProgress.done - importProgress.failed !== 1 ? "s" : ""}.
                            {importProgress.failed > 0 && ` (${importProgress.failed} failed)`}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <ActionButton onClick={onClose} disabled={isImporting}>
                            {importDone ? "Close" : "Cancel"}
                        </ActionButton>
                        {!importDone && (
                            <ActionButton
                                primary
                                onClick={handleImport}
                                disabled={!canImport}
                            >
                                {isImporting ? "Importing..." : `Import ${parsedTasks.length > 0 ? parsedTasks.length : ""} Task${parsedTasks.length !== 1 ? "s" : ""}`}
                            </ActionButton>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
