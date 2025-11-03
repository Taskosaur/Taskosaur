import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import moment from "moment";
import {
  HiBuildingOffice2,
  HiDocumentText,
  HiSparkles,
  HiChevronDown,
  HiCheck,
  HiCalendar,
  HiFlag,
  HiExclamationTriangle,
  HiTag,
} from "react-icons/hi2";
import { HiClipboardList } from "react-icons/hi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ActionButton from "@/components/common/ActionButton";
import { Button } from "../ui/button";
import { useWorkspace } from "@/contexts/workspace-context";
import { useProject } from "@/contexts/project-context";
import { useTask } from "@/contexts/task-context";
import { toast } from "sonner";
import { PRIORITY_OPTIONS, TASK_TYPE_OPTIONS } from "@/utils/data/taskData";
interface FormData {
  title: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    slug: string;
  } | null;
  dueDate: string;
  priority: string;
  type: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => Promise<void>;
  workspaceSlug?: string;
  projectSlug?: string;
  isAuth?: boolean;
}

export function NewTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  workspaceSlug,
  projectSlug,
  isAuth,
}: NewTaskModalProps) {
  const pathname = usePathname();

  const { getWorkspacesByOrganization, getCurrentOrganizationId, getWorkspaceBySlug } =
    useWorkspace();
  const { getProjectsByWorkspace, getTaskStatusByProject } = useProject();
  const { createTask } = useTask();
  const { fetchAnalyticsData } = useProject();

  const [formData, setFormData] = useState<FormData>({
    title: "",
    workspace: null,
    project: null,
    dueDate: "",
    priority: "MEDIUM",
    type: "TASK",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [taskStatuses, setTaskStatuses] = useState<any[]>([]);

  const getUrlContext = () => {
    const pathParts = pathname?.split("/").filter(Boolean);

    const globalRoutes = ["dashboard", "workspaces", "activity", "settings", "tasks"];
    if (pathParts.length === 0 || globalRoutes.includes(pathParts[0])) {
      return { type: "global" };
    }

    if (pathParts.length >= 1 && !globalRoutes.includes(pathParts[0])) {
      const workspaceSlug = pathParts[0];

      if (
        pathParts.length >= 2 &&
        !["projects", "members", "activity", "tasks", "analytics", "settings"].includes(
          pathParts[1]
        )
      ) {
        const projectSlug = pathParts[1];
        return {
          type: "project",
          workspaceSlug,
          projectSlug,
        };
      }

      return {
        type: "workspace",
        workspaceSlug,
      };
    }

    return { type: "global" };
  };

  const urlContext = getUrlContext();

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string>("");

  const retryFetch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    requestIdRef.current = "";
    setWorkspaces([]);
    setProjects([]);
    setTaskStatuses([]);
    setError(null);
    setLoadingWorkspaces(true);
    setLoadingProjects(true);

    if (workspaceSlug && projectSlug) {
      loadProjectFromUrl(workspaceSlug, projectSlug);
    } else {
      loadInitialData();
    }
    loadTaskStatuses();
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      requestIdRef.current = "";
    };
  }, []);

  const loadInitialData = async () => {
    const requestId = `load-${moment().valueOf()}-${Math.random()}`;
    requestIdRef.current = requestId;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (requestIdRef.current !== requestId) return;

      if (urlContext.type === "global") {
        await loadWorkspaces();
      } else if (urlContext.type === "workspace") {
        await loadWorkspaceFromUrl(urlContext.workspaceSlug);
      } else if (urlContext.type === "project") {
        await loadProjectFromUrl(urlContext.workspaceSlug, urlContext.projectSlug);
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load initial data";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (workspaceSlug && projectSlug) {
        loadProjectFromUrl(workspaceSlug, projectSlug);
      } else {
        loadInitialData();
      }
    }
  }, [isOpen, workspaceSlug, projectSlug]);

  useEffect(() => {
    if (formData.project?.id) {
      loadTaskStatuses();
    }
  }, [formData.project?.id]);

  useEffect(() => {
    if (formData.workspace?.id && urlContext.type !== "project") {
      loadProjects(formData.workspace.id);
    } else if (urlContext.type === "global") {
      setProjects([]);
      setFormData((prev) => ({ ...prev, project: null }));
    }
  }, [formData.workspace?.id, urlContext.type]);

  const loadWorkspaceFromUrl = async (workspaceSlug: string) => {
    setLoadingWorkspaces(true);
    setError(null);

    try {
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error("No organization selected. Please select an organization first.");
      }

      const workspace = await getWorkspaceBySlug(workspaceSlug, organizationId);
      setFormData((prev) => ({
        ...prev,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load workspace";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const loadProjectFromUrl = async (workspaceSlug: string, projectSlug: string) => {
    setLoadingWorkspaces(true);
    setLoadingProjects(true);
    setError(null);

    try {
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error("No organization selected. Please select an organization first.");
      }

      const workspace = await getWorkspaceBySlug(workspaceSlug, organizationId);

      const projectsData = await getProjectsByWorkspace(workspace.id);
      const project = projectsData.find((p) => p.slug === projectSlug);

      if (!project) {
        throw new Error(`Project "${projectSlug}" not found in workspace "${workspaceSlug}"`);
      }

      setFormData((prev) => ({
        ...prev,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
        },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load project";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingWorkspaces(false);
      setLoadingProjects(false);
    }
  };

  const loadWorkspaces = async () => {
    setLoadingWorkspaces(true);
    setError(null);

    try {
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error("No organization selected. Please select an organization first.");
      }

      const workspacesData = await getWorkspacesByOrganization(organizationId);
      setWorkspaces(workspacesData || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load workspaces";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Failed to load workspaces:", error);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const loadProjects = async (workspaceId: string) => {
    setLoadingProjects(true);
    setError(null);

    try {
      const projectsData = await getProjectsByWorkspace(workspaceId);
      setProjects(projectsData || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load projects";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Failed to load projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadTaskStatuses = async () => {
    if (!formData.project?.id) return;

    try {
      const statuses = await getTaskStatusByProject(formData.project.id);
      setTaskStatuses(statuses || []);
    } catch (error) {
      console.error("Failed to load task statuses:", error);
    }
  };

  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValid) {
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const defaultStatus =
          taskStatuses.find(
            (status) =>
              status.name.toLowerCase() === "todo" ||
              status.name.toLowerCase() === "to do" ||
              status.isDefault
          ) || taskStatuses[0];

        if (!defaultStatus) {
          throw new Error("No task status available. Please contact your administrator.");
        }

        const taskData = {
          title: formData.title.trim(),
          description: "",
          priority: formData.priority as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
          type: ["TASK", "BUG", "EPIC", "STORY"].includes(formData.type)
            ? (formData.type as "TASK" | "BUG" | "EPIC" | "STORY")
            : "TASK",
          dueDate: formData.dueDate ? moment(formData.dueDate).toISOString() : undefined,
          projectId: formData.project!.id,
          statusId: defaultStatus.id,
        };
        await createTask(taskData);

        if (projectSlug && workspaceSlug) {
          await fetchAnalyticsData(projectSlug, isAuth);
        }

        if (onTaskCreated) {
          try {
            await onTaskCreated();
          } catch (refreshError) {
            console.error("Failed to refresh tasks:", refreshError);
            toast.warning("Task created but failed to refresh list. Please refresh the page.");
          }
        }

        toast.success("Task created successfully!");
        handleClose();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create task";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Failed to create task:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, taskStatuses, onTaskCreated]
  );

  const handleClose = useCallback(() => {
    setFormData({
      title: "",
      workspace: null,
      project: null,
      dueDate: "",
      priority: "MEDIUM",
      type: "TASK",
    });

    setWorkspaces([]);
    setProjects([]);
    setWorkspaceSearch("");
    setProjectSearch("");
    setWorkspaceOpen(false);
    setProjectOpen(false);
    setIsSubmitting(false);
    setError(null);

    onClose();
  }, [onClose]);

  const isValid = formData.title.trim().length > 0 && formData.project && formData.priority;

  const getToday = () => {
    return moment().format("YYYY-MM-DD");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="projects-modal-container border-none">
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--primary)]">
              <HiClipboardList className="projects-modal-icon-content" />
            </div>
            <div className="projects-modal-info">
              <DialogTitle className="projects-modal-title">Create new task</DialogTitle>
              <DialogDescription className="projects-modal-description">
                Add a task to help organize your work and track progress
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="projects-modal-form">
          {error && (
            <Alert
              variant="destructive"
              className="bg-[var(--destructive)]/10 border-[var(--destructive)]/20 text-[var(--destructive)]"
            >
              <HiExclamationTriangle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                {error}
                <ActionButton
                  secondary
                  onClick={retryFetch}
                  className="h-9 w-24 mt-2"
                  disabled={isSubmitting}
                >
                  Try Again
                </ActionButton>
              </AlertDescription>
            </Alert>
          )}

          <div className="projects-form-field">
            <Label htmlFor="title" className="projects-form-label">
              <HiSparkles
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Task title <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enter task title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="projects-workspace-button border-none"
              style={
                {
                  "--tw-ring-color": "hsl(var(--primary) / 0.2)",
                } as any
              }
              onFocus={(e) => {
                e.target.style.boxShadow = "none";
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = "none";
              }}
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {urlContext.type === "global" && (
            <div className="projects-form-field">
              <Label className="projects-form-label">
                <HiBuildingOffice2
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Workspace <span className="projects-form-label-required">*</span>
              </Label>
              <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="projects-workspace-button border-none"
                    disabled={loadingWorkspaces || isSubmitting}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {loadingWorkspaces ? (
                      <span className="projects-workspace-loading">Loading workspaces...</span>
                    ) : formData.workspace ? (
                      <span className="projects-workspace-selected">{formData.workspace.name}</span>
                    ) : (
                      <span className="projects-workspace-placeholder">Select workspace</span>
                    )}
                    <HiChevronDown className="projects-workspace-dropdown-icon" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="projects-workspace-popover border-none" align="start">
                  <Command className="projects-workspace-command border-none">
                    <CommandInput
                      placeholder="Search workspaces..."
                      value={workspaceSearch}
                      onValueChange={setWorkspaceSearch}
                      className="projects-workspace-command-input"
                    />
                    <CommandEmpty className="projects-workspace-command-empty">
                      {loadingWorkspaces
                        ? "Loading workspaces..."
                        : filteredWorkspaces.length === 0 && workspaceSearch
                          ? "No workspaces found."
                          : "No workspaces available"}
                    </CommandEmpty>
                    <CommandGroup className="projects-workspace-command-group">
                      {filteredWorkspaces.map((workspace) => (
                        <CommandItem
                          key={workspace.id}
                          value={workspace.name}
                          onSelect={() => {
                            setFormData((prev) => ({
                              ...prev,
                              workspace: {
                                id: workspace.id,
                                name: workspace.name,
                                slug: workspace.slug,
                              },
                              project: null,
                            }));
                            setWorkspaceOpen(false);
                          }}
                          className="projects-workspace-command-item"
                        >
                          <span className="projects-workspace-command-item-name">
                            {workspace.name}
                          </span>
                          {formData.workspace?.id === workspace.id && (
                            <HiCheck className="projects-workspace-command-item-check" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {urlContext.type !== "project" && (
            <div className="projects-form-field">
              <Label className="projects-form-label">
                <HiDocumentText
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Project <span className="projects-form-label-required">*</span>
              </Label>
              <Popover open={projectOpen} onOpenChange={setProjectOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="projects-workspace-button border-none"
                    disabled={!formData.workspace || loadingProjects || isSubmitting}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {loadingProjects ? (
                      <span className="projects-workspace-loading">Loading projects...</span>
                    ) : formData.project ? (
                      <span className="projects-workspace-selected">{formData.project.name}</span>
                    ) : formData.workspace ? (
                      <span className="projects-workspace-placeholder">Select project</span>
                    ) : (
                      <span className="projects-workspace-placeholder">Select workspace first</span>
                    )}
                    <HiChevronDown className="projects-workspace-dropdown-icon" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="projects-workspace-popover border-none" align="start">
                  <Command className="projects-workspace-command border-none">
                    <CommandInput
                      placeholder="Search projects..."
                      value={projectSearch}
                      onValueChange={setProjectSearch}
                      className="projects-workspace-command-input"
                    />
                    <CommandEmpty className="projects-workspace-command-empty">
                      {loadingProjects
                        ? "Loading projects..."
                        : filteredProjects.length === 0 && projectSearch
                          ? "No projects found."
                          : "No projects available"}
                    </CommandEmpty>
                    <CommandGroup className="projects-workspace-command-group">
                      {filteredProjects.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={project.name}
                          onSelect={() => {
                            setFormData((prev) => ({
                              ...prev,
                              project: {
                                id: project.id,
                                name: project.name,
                                slug: project.slug,
                              },
                            }));
                            setProjectOpen(false);
                          }}
                          className="projects-workspace-command-item"
                        >
                          <span className="projects-workspace-command-item-name">
                            {project.name}
                          </span>
                          {formData.project?.id === project.id && (
                            <HiCheck className="projects-workspace-command-item-check" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="projects-form-field">
              <Label htmlFor="dueDate" className="projects-form-label">
                <HiCalendar
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Due date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                min={getToday()}
                className="border-none transition-colors duration-300 h-10 w-full font-normal  rounded-md"
                onFocus={(e) => {
                  e.target.style.boxShadow = "none";
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = "none";
                }}
                disabled={isSubmitting}
              />
            </div>

            <div className="projects-form-field">
              <Label className="projects-form-label">
                <HiFlag
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Priority <span className="projects-form-label-required">*</span>
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  className="projects-workspace-button border-none"
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--card)]">
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="hover:bg-[var(--hover-bg)]"
                    >
                      <div className="flex items-center gap-2">{option.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="projects-form-field">
              <Label className="projects-form-label">
                <HiTag
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Type <span className="projects-form-label-required">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  className="projects-workspace-button border-none"
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--card)]">
                  {TASK_TYPE_OPTIONS.map((option) => {
                    return (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="hover:bg-[var(--hover-bg)]"
                      >
                        <div className="flex items-center gap-2">{option.label}</div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="projects-form-actions flex gap-2 justify-end mt-6">
            <ActionButton type="button" secondary onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" primary disabled={!isValid || isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating task...
                </div>
              ) : (
                "Create"
              )}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
