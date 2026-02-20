import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
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
  HiBolt,
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
  CommandList,
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
import { useSprint } from "@/contexts/sprint-context";
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
  storyPoints: string;
  sprintId?: string;
  parentTaskId?: string;
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
  const { t } = useTranslation("tasks");
  const pathname = usePathname();

  const { getWorkspacesByOrganization, getCurrentOrganizationId, getWorkspaceBySlug } =
    useWorkspace();
  const { getProjectsByWorkspace, getTaskStatusByProject } = useProject();
  const { createTask } = useTask();
  const { fetchAnalyticsData } = useProject();
  const { getSprintsByProject, getActiveSprint } = useSprint();

  const [formData, setFormData] = useState<FormData>({
    title: "",
    workspace: null,
    project: null,
    dueDate: "",
    priority: "MEDIUM",
    type: "TASK",
    storyPoints: "",
    sprintId: "",
    parentTaskId: "",
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

  const [sprints, setSprints] = useState<any[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);

  const [parentTasks, setParentTasks] = useState<any[]>([]);
  const [loadingParentTasks, setLoadingParentTasks] = useState(false);

  const [openParentTask, setOpenParentTask] = useState(false);
  const [parentTaskSearch, setParentTaskSearch] = useState("");

  const filteredParentTasks = parentTasks
    .filter((task) => {
      const searchLower = parentTaskSearch.toLowerCase();
      return (
        task.title.toLowerCase().includes(searchLower) ||
        (task.taskNumber && task.taskNumber.toString().toLowerCase().includes(searchLower))
      );
    })
    .slice(0, 5);

  const [taskStatuses, setTaskStatuses] = useState<any[]>([]);

  const getUrlContext = () => {
    const pathParts = pathname?.split("/").filter(Boolean) || [];

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
    setSprints([]);
    setParentTasks([]);
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
        const errorMessage = error instanceof Error ? error.message : t("modal.errorLoadWorkspaces");
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
      loadSprints();
      if (formData.type === "SUBTASK") {
        loadParentTasks();
      }
    }
  }, [formData.project?.id]);

  useEffect(() => {
    if (formData.type === "SUBTASK" && formData.project?.id) {
      loadParentTasks();
    } else {
      setParentTasks([]);
      setFormData((prev) => ({ ...prev, parentTaskId: "" }));
    }
  }, [formData.type]);

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
        throw new Error(t("modal.errorNoOrg"));
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
      const errorMessage = error instanceof Error ? error.message : t("modal.errorLoadWorkspace");
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
        throw new Error(t("modal.errorNoOrg"));
      }

      const workspace = await getWorkspaceBySlug(workspaceSlug, organizationId);

      const projectsData = await getProjectsByWorkspace(workspace.id);
      const project = projectsData.find((p) => p.slug === projectSlug);

      if (!project) {
        throw new Error(t("projectTasksDescription", { name: projectSlug }));
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
      const errorMessage = error instanceof Error ? error.message : t("modal.errorLoadProject");
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
        throw new Error(t("modal.errorNoOrg"));
      }

      const workspacesData = await getWorkspacesByOrganization(organizationId);
      setWorkspaces(workspacesData || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("modal.errorLoadWorkspaces");
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
      const errorMessage = error instanceof Error ? error.message : t("modal.errorLoadProjects");
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

  const loadSprints = async () => {
    if (!formData.project?.id) return;

    setLoadingSprints(true);
    try {
      const [projectSprints, activeSprint] = await Promise.all([
        getSprintsByProject(formData.project.slug),
        getActiveSprint(formData.project.id),
      ]);
      setSprints(projectSprints || []);

      if (activeSprint) {
        setFormData(prev => ({ ...prev, sprintId: activeSprint.id }));
      } else if (projectSprints && projectSprints.length > 0) {
        const defaultSprint = projectSprints.find((s: any) => s.isDefault);
        if (defaultSprint) {
          setFormData(prev => ({ ...prev, sprintId: defaultSprint.id }));
        }
      }
    } catch (error) {
      console.error("Failed to load sprints:", error);
    } finally {
      setLoadingSprints(false);
    }
  };

  const loadParentTasks = async () => {
    if (!formData.project?.id) return;
    setLoadingParentTasks(true);
    try {
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) return;
      const response = await import("@/lib/api").then((m) => m.default.get(`/tasks?organizationId=${organizationId}&projectId=${formData.project!.id}&parentTaskId=null`));
      const tasks = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setParentTasks(tasks);
    } catch (error) {
      console.error("Failed to load parent tasks:", error);
      setParentTasks([]);
    } finally {
      setLoadingParentTasks(false);
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
          throw new Error(t("modal.errorNoStatus"));
        }

        const taskData: any = {
          title: formData.title.trim(),
          description: "",
          priority: formData.priority as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
          type: ["TASK", "BUG", "EPIC", "STORY", "SUBTASK"].includes(formData.type)
            ? formData.type
            : "TASK",
          storyPoints: formData.storyPoints ? parseInt(formData.storyPoints) : undefined,
          dueDate: formData.dueDate ? moment(formData.dueDate).toISOString() : undefined,
          projectId: formData.project!.id,
          statusId: defaultStatus?.id,
        };

        if (formData.sprintId) taskData.sprintId = formData.sprintId;
        if (formData.type === "SUBTASK" && formData.parentTaskId) taskData.parentTaskId = formData.parentTaskId;
        await createTask(taskData);

        if (projectSlug && workspaceSlug) {
          await fetchAnalyticsData(projectSlug, isAuth);
        }

        if (onTaskCreated) {
          try {
            await onTaskCreated();
          } catch (refreshError) {
            console.error("Failed to refresh tasks:", refreshError);
            toast.warning(t("modal.errorRefresh"));
          }
        }

        toast.success(t("modal.success"));
        handleClose();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t("modal.errorCreate");
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
      storyPoints: "",
      sprintId: "",
      parentTaskId: "",
    });

    setWorkspaces([]);
    setProjects([]);
    setParentTasks([]);
    setWorkspaceSearch("");
    setProjectSearch("");
    setWorkspaceOpen(false);
    setProjectOpen(false);
    setIsSubmitting(false);
    setError(null);

    onClose();
  }, [onClose]);

  const isValid = formData.title.trim().length > 0 && formData.project && formData.priority && (formData.type !== "SUBTASK" || formData.parentTaskId);

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
              <DialogTitle className="projects-modal-title">{t("modal.createTitle")}</DialogTitle>
              <DialogDescription className="projects-modal-description">
                {t("modal.createDescription")}
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
                  {t("modal.tryAgain")}
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
              {t("modal.taskTitle")} <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="title"
              placeholder={t("modal.enterTaskTitle")}
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
                {t("modal.workspace")} <span className="projects-form-label-required">*</span>
              </Label>
              <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-label="Select workspace"
                    data-automation-id="select-workspace"
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
                      <span className="projects-workspace-loading">{t("modal.loadingWorkspaces")}</span>
                    ) : formData.workspace ? (
                      <span className="projects-workspace-selected">{formData.workspace.name}</span>
                    ) : (
                      <span className="projects-workspace-placeholder">{t("modal.selectWorkspace")}</span>
                    )}
                    <HiChevronDown className="projects-workspace-dropdown-icon" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="projects-workspace-popover border-none" align="start">
                  <Command className="projects-workspace-command border-none">
                    <CommandInput
                      data-automation-id="search-workspace-input"
                      placeholder={t("modal.searchWorkspaces")}
                      value={workspaceSearch}
                      onValueChange={setWorkspaceSearch}
                      className="projects-workspace-command-input"
                    />
                    <CommandEmpty className="projects-workspace-command-empty">
                      {loadingWorkspaces
                        ? t("modal.loadingWorkspaces")
                        : filteredWorkspaces.length === 0 && workspaceSearch
                          ? t("modal.noWorkspacesFound")
                          : t("modal.noWorkspacesAvailable")}
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
                {t("modal.project")} <span className="projects-form-label-required">*</span>
              </Label>
              <Popover open={projectOpen} onOpenChange={setProjectOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-label="Select project"
                    data-automation-id="select-project"
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
                      <span className="projects-workspace-loading">{t("modal.loadingProjects")}</span>
                    ) : formData.project ? (
                      <span className="projects-workspace-selected">{formData.project.name}</span>
                    ) : formData.workspace ? (
                      <span className="projects-workspace-placeholder">{t("modal.selectProject")}</span>
                    ) : (
                      <span className="projects-workspace-placeholder">{t("modal.selectWorkspaceFirst")}</span>
                    )}
                    <HiChevronDown className="projects-workspace-dropdown-icon" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="projects-workspace-popover border-none" align="start">
                  <Command className="projects-workspace-command border-none">
                    <CommandInput
                      data-automation-id="search-project-input"
                      placeholder={t("modal.searchProjects")}
                      value={projectSearch}
                      onValueChange={setProjectSearch}
                      className="projects-workspace-command-input"
                    />
                    <CommandEmpty className="projects-workspace-command-empty">
                      {loadingProjects
                        ? t("modal.loadingProjects")
                        : filteredProjects.length === 0 && projectSearch
                          ? t("modal.noProjectsFound")
                          : t("modal.noProjectsAvailable")}
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="projects-form-field">
              <Label htmlFor="dueDate" className="projects-form-label">
                <HiCalendar
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                {t("modal.dueDate")}
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
                {t("modal.priority")} <span className="projects-form-label-required">*</span>
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
                  <SelectValue placeholder={t("modal.selectPriority")} />
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
                {t("modal.type")} <span className="projects-form-label-required">*</span>
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
                  <SelectValue placeholder={t("modal.selectType")} />
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

            {formData.type === "SUBTASK" && (
              <div className="projects-form-field col-span-2 md:col-span-4">
                <Label className="projects-form-label">
                  <HiClipboardList
                    className="projects-form-label-icon"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  {t("modal.parentTask", "Parent Task")} <span className="projects-form-label-required">*</span>
                </Label>
                <Popover open={openParentTask} onOpenChange={setOpenParentTask}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openParentTask}
                      className="w-full justify-between projects-workspace-button border-none font-normal px-3"
                      disabled={isSubmitting || !formData.project || loadingParentTasks}
                    >
                      <span className="truncate">
                        {formData.parentTaskId
                          ? parentTasks.find((task) => task.id === formData.parentTaskId)?.title || formData.parentTaskId
                          : !formData.project
                            ? t("modal.selectProjectFirst", "Select project first")
                            : loadingParentTasks
                              ? t("modal.loading", "Loading...")
                              : t("modal.selectParentTask", "Select parent task")}
                      </span>
                      <HiChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 border-[var(--border)] bg-[var(--popover)]" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={t("modal.searchParentTask", "Search parent task...")}
                        value={parentTaskSearch}
                        onValueChange={setParentTaskSearch}
                      />
                      <CommandList>
                        <CommandEmpty>{t("modal.noParentTaskFound", "No parent task found.")}</CommandEmpty>
                        <CommandGroup>
                          {filteredParentTasks.map((task) => (
                            <CommandItem
                              key={task.id}
                              value={task.id}
                              onSelect={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  parentTaskId: task.id === formData.parentTaskId ? "" : task.id,
                                }));
                                setOpenParentTask(false);
                              }}
                              className="cursor-pointer hover:bg-[var(--hover-bg)] aria-selected:bg-[var(--hover-bg)]"
                            >
                              <HiCheck
                                className={`mr-2 h-4 w-4 ${formData.parentTaskId === task.id ? "opacity-100" : "opacity-0"
                                  }`}
                              />
                              <span className="truncate">
                                {task.taskNumber ? `${task.taskNumber} - ` : ""}
                                {task.title}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="projects-form-field">
              <Label htmlFor="storyPoints" className="projects-form-label">
                <HiSparkles
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                {t("modal.storyPoints")}
              </Label>
              <Input
                id="storyPoints"
                type="number"
                min="0"
                placeholder="0"
                value={formData.storyPoints}
                onChange={(e) => setFormData((prev) => ({ ...prev, storyPoints: e.target.value }))}
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
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="projects-form-field mt-4">
            <Label className="projects-form-label">
              <HiBolt
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              {t("modal.sprint")}
            </Label>
            <Select
              value={formData.sprintId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, sprintId: value }))}
              disabled={isSubmitting || !formData.project || loadingSprints}
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
                <SelectValue placeholder={!formData.project ? t("modal.selectProjectFirst") : t("modal.selectSprint")} />
              </SelectTrigger>
              <SelectContent className="border-none bg-[var(--card)]">
                {sprints.map((sprint) => (
                  <SelectItem
                    key={sprint.id}
                    value={sprint.id}
                    className="hover:bg-[var(--hover-bg)]"
                  >
                    <div className="flex items-center gap-2">
                      {sprint.name} {sprint.isDefault === true && `(${t("modal.default")})`}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="projects-form-actions flex gap-2 justify-end mt-6">
            <ActionButton type="button" secondary onClick={handleClose} disabled={isSubmitting}>
              {t("modal.cancel")}
            </ActionButton>
            <ActionButton id="create-task-submit" data-automation-id="create-task-submit" type="submit" primary disabled={!isValid || isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  {t("modal.creating")}
                </div>
              ) : (
                t("modal.create")
              )}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
