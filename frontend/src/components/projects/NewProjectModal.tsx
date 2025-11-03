import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ActionButton from "@/components/common/ActionButton";
import { toast } from "sonner";
import {
  HiChevronDown,
  HiCheck,
  HiFolderPlus,
  HiBuildingOffice2,
  HiDocumentText,
  HiSparkles,
  HiRocketLaunch,
  HiCog,
  HiGlobeAlt,
} from "react-icons/hi2";
import { HiColorSwatch } from "react-icons/hi";
import { useWorkspace } from "@/contexts/workspace-context";
import { useProject } from "@/contexts/project-context";
import { getCurrentWorkspaceId } from "@/utils/hierarchyContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PROJECT_CATEGORIES } from "@/utils/data/projectData";
import { workflowsApi } from "@/utils/api/workflowsApi";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug?: string;
  onProjectCreated?: () => void;
  initialData?: {
    organizationId?: string;
  };
}

export function NewProjectModal({
  isOpen,
  onClose,
  workspaceSlug,
  onProjectCreated,
}: NewProjectModalProps) {
  const workspaceContext = useWorkspace();
  const projectContext = useProject();

  const { getWorkspacesByOrganization, getWorkspaceById, getWorkspaceBySlug } = workspaceContext;
  const { createProject } = projectContext;
  const isWorkspacePreSelected = Boolean(workspaceSlug);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    workspace: null as any,
    color: "#3B82F6",
    category: "operational",
    workflowId: "",
    visibility: "PRIVATE" as const,
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  // Use projectSlug everywhere it's needed
  const projectSlug = generateSlug(formData.name);

  const themeColor = formData.color;
  const themeColorWithOpacity = (opacity: number) =>
    `${themeColor}${Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0")}`;

  const dynamicStyles = {
    "--dynamic-primary": themeColor,
    "--dynamic-primary-20": themeColorWithOpacity(0.2),
    "--dynamic-primary-10": themeColorWithOpacity(0.1),
    "--dynamic-primary-5": themeColorWithOpacity(0.05),
    "--dynamic-primary-80": themeColorWithOpacity(0.8),
    "--dynamic-primary-90": themeColorWithOpacity(0.9),
  } as React.CSSProperties;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [allWorkspaces, setAllWorkspaces] = useState<any[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string>("");
  const isInitializedRef = useRef(false);

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [visibilityOpen, setVisibilityOpen] = useState(false);

  const filteredWorkspaces = allWorkspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

  const selectedCategory = PROJECT_CATEGORIES.find((cat) => cat.id === formData.category);
  const filteredWorkflows = workflows.filter((wf) =>
    wf.name.toLowerCase().includes(workflowSearch.toLowerCase())
  );
  const selectedWorkflow = workflows.find((wf) => wf.id === formData.workflowId);

  const VISIBILITY_OPTIONS = [
    {
      value: "PRIVATE",
      label: "Private",
      description: "Only members can access this project",
    },
    {
      value: "INTERNAL",
      label: "Internal",
      description: "Workspace members can view, members can edit",
    },
    {
      value: "PUBLIC",
      label: "Public",
      description: "Anyone can view, members can edit",
    },
  ];

  const selectedWorkflowStatuses = selectedWorkflow?.statuses || [];

  const retryFetch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    isInitializedRef.current = false;
    requestIdRef.current = "";
    setAllWorkspaces([]);
    setFormData((prev) => ({
      ...prev,
      workspace: null,
    }));
    setError(null);
    setIsLoadingWorkspaces(true);
    loadWorkspacesAndCurrent();
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isInitializedRef.current = false;
      requestIdRef.current = "";
    };
  }, []);

  const loadWorkspacesAndCurrent = async () => {
    const requestId = `load-${Date.now()}-${Math.random()}`;
    requestIdRef.current = requestId;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoadingWorkspaces(true);
    setError(null);

    try {
      if (requestIdRef.current !== requestId) return;

      if (workspaceSlug) {
        const workspace = await getWorkspaceBySlug(workspaceSlug);
        if (workspace) {
          setFormData((prev) => ({ ...prev, workspace }));
        }
      } else {
        const workspacesData = await getWorkspacesByOrganization();
        if (requestIdRef.current !== requestId) return;

        setAllWorkspaces(workspacesData || []);

        const workspaceId = getCurrentWorkspaceId();
        if (workspaceId && workspacesData) {
          const currentWorkspace = workspacesData.find((ws) => ws.id === workspaceId);
          if (currentWorkspace) {
            setFormData((prev) => ({ ...prev, workspace: currentWorkspace }));
          } else {
            try {
              const workspace = await getWorkspaceById(workspaceId);
              if (workspace) {
                setFormData((prev) => ({ ...prev, workspace }));
              }
            } catch (error) {
              throw new Error("Failed to load current workspace");
            }
          }
        }
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load workspaces";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Failed to load workspaces:", error);
        setAllWorkspaces([]);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoadingWorkspaces(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadWorkspacesAndCurrent();

    const fetchWorkflows = async () => {
      try {
        const orgId = workflowsApi.getCurrentOrganization();
        if (orgId) {
          const wf = await workflowsApi.getWorkflowsByOrganization(orgId);
          setWorkflows(wf || []);

          const defaultWf = (wf || []).find((w) => w.isDefault);
          if (defaultWf) {
            setFormData((prev) => ({ ...prev, workflowId: defaultWf.id }));
          }
        } else {
          setWorkflows([]);
          console.warn("No current organization ID found.");
        }
      } catch (err) {
        setWorkflows([]);
        console.error("Error fetching workflows:", err);
      }
    };
    fetchWorkflows();
  }, [isOpen, workspaceSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.workspace) return;

    setIsSubmitting(true);
    try {
      const projectData = {
        name: formData.name.trim(),
        slug: projectSlug,
        description: formData.description.trim(),
        color: formData.color,
        status: "ACTIVE" as const,
        priority: "MEDIUM" as const,
        visibility: formData.visibility,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        workspaceId: formData.workspace.id,
        workflowId: formData.workflowId,
        settings: {
          methodology: "scrum" as const,
          defaultTaskType: "task" as const,
          enableTimeTracking: false,
          allowSubtasks: true,
          workflowId: formData.workflowId,
        },
      };

      await createProject(projectData);
      toast.success(`Project "${formData.name}" created successfully!`);
      handleClose();
      document.body.style.pointerEvents = "auto";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create project";
      toast.error(errorMessage);
      console.error("Failed to create project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      workspace: null,
      color: "#3B82F6",
      category: "operational",
      workflowId: "",
      visibility: "PRIVATE",
    });
    setWorkspaceSearch("");
    setAllWorkspaces([]);
    setWorkspaceOpen(false);
    setCategoryOpen(false);
    setWorkflowOpen(false);
    setWorkflowSearch("");
    setVisibilityOpen(false);
    onClose();
  };

  const handleCategorySelect = (category: any) => {
    setFormData((prev) => ({
      ...prev,
      category: category.id,
      color: category.color,
    }));
    setCategoryOpen(false);
  };

  // Add workflow select handler
  const handleWorkflowSelect = (workflow: any) => {
    setFormData((prev) => ({
      ...prev,
      workflowId: workflow.id,
    }));
    setWorkflowOpen(false);
  };

  const isValid = formData.name.trim().length > 0 && formData.workspace;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="projects-modal-container border-none" style={dynamicStyles}>
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--dynamic-primary)]">
              <HiFolderPlus className="projects-modal-icon-content" />
            </div>
            <div className="projects-modal-info">
              <DialogTitle className="projects-modal-title">Create new project</DialogTitle>
              <p className="projects-modal-description">
                Organize your tasks and collaborate with your team
              </p>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="projects-modal-form">
          {/* Error Alert with Retry Button */}
          {error && (
            <Alert
              variant="destructive"
              className="bg-[var(--destructive)]/10 border-[var(--destructive)]/20 text-[var(--destructive)] mb-4"
            >
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

          {/* Project Name */}
          <div className="projects-form-field">
            <Label htmlFor="name" className="projects-form-label">
              <HiSparkles
                className="projects-form-label-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Project name <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Enter project name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="projects-form-input border-none"
              style={
                {
                  "--tw-ring-color": "var(--dynamic-primary-20)",
                  borderColor: "var(--border)",
                } as any
              }
              onFocus={(e) => {
                e.target.style.borderColor = "var(--dynamic-primary)";
                e.target.style.boxShadow = `0 0 0 3px var(--dynamic-primary-20)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.boxShadow = "none";
              }}
              autoFocus
            />
            {/* URL Preview */}
            {formData.name && (
              <div
                className="projects-url-preview border-none"
                style={{
                  background: `linear-gradient(135deg, var(--dynamic-primary-5), var(--dynamic-primary-10))`,
                  borderColor: "var(--dynamic-primary-20)",
                }}
              >
                <HiRocketLaunch
                  className="projects-url-preview-icon"
                  style={{ color: "var(--dynamic-primary)" }}
                />
                <div className="projects-url-preview-label">URL:</div>
                <code
                  className="projects-url-preview-code border-none"
                  style={{ color: "var(--dynamic-primary)" }}
                >
                  {formData.workspace ? `/${formData.workspace.slug}` : "/workspace"}/
                  {projectSlug || "project-name"}
                </code>
              </div>
            )}
          </div>

          {/* Workflow - Dropdown  */}
          <div className="projects-form-field">
            <Label className="projects-form-label">
              <HiCog
                className="projects-form-label-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Workflow <span className="projects-form-label-required">*</span>
            </Label>
            <Popover open={workflowOpen} onOpenChange={setWorkflowOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="projects-workspace-button border-none"
                  style={{ borderColor: "var(--border)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--dynamic-primary-20)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--dynamic-primary)";
                    e.currentTarget.style.boxShadow = `0 0 0 3px var(--dynamic-primary-20)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <span className="projects-workspace-selected">
                    {selectedWorkflow?.name || "Select workflow"}
                  </span>
                  <HiChevronDown className="projects-workspace-dropdown-icon" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="projects-workspace-popover border-none" align="start">
                <Command className="projects-workspace-command border-none">
                  <CommandInput
                    placeholder="Search workflows..."
                    value={workflowSearch}
                    onValueChange={setWorkflowSearch}
                    className="projects-workspace-command-input border-none"
                  />
                  <CommandEmpty className="projects-workspace-command-empty">
                    {filteredWorkflows.length === 0 && workflowSearch
                      ? "No workflows found."
                      : "Type to search workflows"}
                  </CommandEmpty>
                  <CommandGroup className="projects-workspace-command-group">
                    {filteredWorkflows.map((workflow) => (
                      <CommandItem
                        key={workflow.id}
                        value={workflow.name}
                        onSelect={() => handleWorkflowSelect(workflow)}
                        className="projects-workspace-command-item"
                      >
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium">{workflow.name}</span>
                            {/* Removed StatusBadge for Default */}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {workflow.statuses &&
                              workflow.statuses.map((status: any) => (
                                <span
                                  key={status.id}
                                  className="px-2 py-0.5 rounded text-white text-[10px] font-semibold"
                                  style={{ backgroundColor: status.color }}
                                >
                                  {status.name}
                                </span>
                              ))}
                          </div>
                        </div>
                        {formData.workflowId === workflow.id && (
                          <HiCheck className="projects-workspace-command-item-check" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="projects-form-hint">
              <HiCog
                className="projects-form-hint-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Choose a workflow for your project's process.
            </p>
          </div>

          {/* Visibility - Dropdown */}
          <div className="projects-form-field">
            <Label className="projects-form-label">
              <HiGlobeAlt
                className="projects-form-label-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Visibility <span className="projects-form-label-required">*</span>
            </Label>
            <Popover open={visibilityOpen} onOpenChange={setVisibilityOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="projects-workspace-button border-none"
                  style={{ borderColor: "var(--border)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--dynamic-primary-20)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--dynamic-primary)";
                    e.currentTarget.style.boxShadow = `0 0 0 3px var(--dynamic-primary-20)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <span className="projects-workspace-selected">
                    {VISIBILITY_OPTIONS.find((v) => v.value === formData.visibility)?.label ||
                      "Select visibility"}
                  </span>
                  <HiChevronDown className="projects-workspace-dropdown-icon" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="projects-workspace-popover border-none" align="start">
                <Command className="projects-workspace-command border-none">
                  <CommandEmpty className="projects-workspace-command-empty">
                    No visibility options found.
                  </CommandEmpty>
                  <CommandGroup className="projects-workspace-command-group">
                    {VISIBILITY_OPTIONS.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
                          setFormData((prev) => ({
                            ...prev,
                            visibility: option.value as any,
                          }));
                          setVisibilityOpen(false);
                        }}
                        className="projects-workspace-command-item"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[14px] font-medium">{option.label}</span>
                        </div>
                        <span className="text-[12px] text-muted-foreground ml-7">
                          {option.description}
                        </span>
                        {formData.visibility === option.value && (
                          <HiCheck className="projects-workspace-command-item-check" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="projects-form-hint">
              <HiGlobeAlt
                className="projects-form-hint-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Control who can access this project.
            </p>
          </div>

          {/* Workspace - Conditionally rendered */}
          {!isWorkspacePreSelected && (
            <div className="projects-form-field">
              <Label className="projects-form-label">
                <HiBuildingOffice2
                  className="projects-form-label-icon"
                  style={{ color: "var(--dynamic-primary)" }}
                />
                Workspace <span className="projects-form-label-required">*</span>
              </Label>
              <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="projects-workspace-button border-none"
                    style={{
                      borderColor: "var(--border)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--dynamic-primary-20)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--dynamic-primary)";
                      e.currentTarget.style.boxShadow = `0 0 0 3px var(--dynamic-primary-20)`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    disabled={isLoadingWorkspaces}
                  >
                    {isLoadingWorkspaces ? (
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
                      className="projects-workspace-command-input border-none"
                    />
                    <CommandEmpty className="projects-workspace-command-empty">
                      {isLoadingWorkspaces
                        ? "Loading workspaces..."
                        : filteredWorkspaces.length === 0 && workspaceSearch
                          ? "No workspaces found."
                          : "Type to search workspaces"}
                    </CommandEmpty>
                    <CommandGroup className="projects-workspace-command-group">
                      {filteredWorkspaces.map((workspace) => (
                        <CommandItem
                          key={workspace.id}
                          value={workspace.name}
                          onSelect={() => {
                            setFormData((prev) => ({ ...prev, workspace }));
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

          {/* Workspace - Read-only field when pre-selected */}
          {isWorkspacePreSelected && formData.workspace && (
            <div className="projects-form-field">
              <Label className="projects-form-label">
                <HiBuildingOffice2
                  className="projects-form-label-icon"
                  style={{ color: "var(--dynamic-primary)" }}
                />
                Workspace
              </Label>
              <Input
                value={formData.workspace.name}
                readOnly
                className="projects-form-input border-none bg-muted/50 cursor-not-allowed"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--muted)",
                  color: "var(--muted-foreground)",
                }}
              />
              <p className="projects-form-hint">
                <HiBuildingOffice2
                  className="projects-form-hint-icon"
                  style={{ color: "var(--dynamic-primary)" }}
                />
                Project will be created in this workspace.
              </p>
            </div>
          )}

          {/* Description */}
          <div className="projects-form-field">
            <Label htmlFor="description" className="projects-form-label">
              <HiDocumentText
                className="projects-form-label-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe what this project is about..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="projects-form-textarea border-none"
              style={{
                borderColor: "var(--border)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--dynamic-primary)";
                e.target.style.boxShadow = `0 0 0 3px var(--dynamic-primary-20)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.boxShadow = "none";
              }}
            />
            <p className="projects-form-hint">
              <HiSparkles
                className="projects-form-hint-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Help your team understand the project's goals and scope.
            </p>
          </div>

          {/* Project Category - Dropdown */}
          <div className="projects-form-field">
            <Label className="projects-form-label">
              <HiColorSwatch
                className="projects-form-label-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Project Colors
            </Label>
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="projects-workspace-button border-none"
                  style={{
                    borderColor: "var(--border)",
                    height: "2.5rem", // Match input height
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--dynamic-primary-20)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--dynamic-primary)";
                    e.currentTarget.style.boxShadow = `0 0 0 3px var(--dynamic-primary-20)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="size-6 rounded-sm"
                      style={{ backgroundColor: selectedCategory?.color }}
                    />
                    <span className="projects-workspace-selected">
                      {selectedCategory?.label || "Select category"}
                    </span>
                  </div>
                  <HiChevronDown className="projects-workspace-dropdown-icon" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="projects-workspace-popover border-none" align="start">
                <Command className="projects-workspace-command border-none">
                  <CommandEmpty className="projects-workspace-command-empty">
                    No categories found.
                  </CommandEmpty>
                  <CommandGroup className="projects-workspace-command-group">
                    {PROJECT_CATEGORIES.map((category) => (
                      <CommandItem
                        key={category.id}
                        value={category.label}
                        onSelect={() => handleCategorySelect(category)}
                        className="projects-workspace-command-item"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className="size-7 rounded-sm"
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="flex flex-col">
                            <span className="text-[14px] font-medium">{category.label}</span>
                            <span className="text-[12px] text-muted-foreground">
                              {category.description}
                            </span>
                          </div>
                        </div>
                        {formData.category === category.id && (
                          <HiCheck className="projects-workspace-command-item-check" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="projects-form-hint">
              <HiColorSwatch
                className="projects-form-hint-icon"
                style={{ color: "var(--dynamic-primary)" }}
              />
              Choose a category to help organize and identify your project.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="projects-form-actions flex gap-2 justify-end mt-6">
            <ActionButton type="button" secondary onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" primary disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Creating project..." : "Create project"}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
