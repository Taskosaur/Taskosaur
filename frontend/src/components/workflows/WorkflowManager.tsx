import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { workflowsApi } from "@/utils/api/workflowsApi";
import WorkflowEditor from "./WorkflowEditor";
import StatusConfiguration from "./StatusConfiguration";
import CreateWorkflowForm from "./CreateWorkflowForm";
import {
  HiPlus,
  HiCog,
  HiEye,
  HiPencil,
  HiTrash,
  HiCheck,
  HiChevronRight,
  HiExclamationTriangle,
  HiArrowPath,
} from "react-icons/hi2";
import { HiViewGrid } from "react-icons/hi";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateWorkflowData, TaskStatus, Workflow } from "@/types";
import Tooltip from "../common/ToolTip";
import { Check } from "lucide-react";
import ConfirmationModal from "../modals/ConfirmationModal";
import WorkFlowSkeleton from "../skeletons/WorkFlowSkeleton";

interface WorkflowManagerProps {
  organizationId?: string;
  workflows: Workflow[];
  isLoading?: boolean;
  error?: string | null;
  onCreateWorkflow?: (workflow: Workflow) => void;
  onUpdateWorkflow?: (workflow: Workflow) => void;
  onDeleteWorkflow?: (workflowId: string) => void;
  onSetDefaultWorkflow?: (workflowId: string) => void;
  isProjectLevel?: boolean;
  onRefresh?: () => void;
}

const validateWorkflow = (workflow: any): workflow is Workflow => {
  if (!workflow || typeof workflow !== "object") return false;

  const hasRequiredFields =
    typeof workflow.id === "string" &&
    typeof workflow.name === "string" &&
    typeof workflow.organizationId === "string";

  return hasRequiredFields;
};

const normalizeWorkflow = (workflow: any): Workflow => {
  const statuses = Array.isArray(workflow?.statuses) ? workflow.statuses : [];
  const transitions = Array.isArray(workflow?.transitions) ? workflow.transitions : [];

  const _count = {
    statuses: statuses.length,
    transitions: transitions.length,
    tasks: workflow?._count?.tasks || 0,
  };

  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description || "",
    organizationId: workflow.organizationId,
    isDefault: workflow.isDefault || false,
    statuses,
    transitions,
    _count,
    createdAt: workflow.createdAt || new Date().toISOString(),
    updatedAt: workflow.updatedAt || new Date().toISOString(),
    createdBy: workflow.createdBy,
    updatedBy: workflow.updatedBy,
  };
};

export default function WorkflowManager({
  workflows: rawWorkflows = [],
  isLoading = false,
  error = null,
  onCreateWorkflow,
  onDeleteWorkflow,
  onSetDefaultWorkflow,
  isProjectLevel = false,
  organizationId,
  onRefresh,
}: WorkflowManagerProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "editor" | "statuses">("overview");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const { getCurrentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const currentUser = getCurrentUser();

  const workflows = React.useMemo(() => {
    if (!Array.isArray(rawWorkflows)) {
      setValidationErrors(["Invalid workflow data: expected array"]);
      return [];
    }

    const errors: string[] = [];
    const normalizedWorkflows = rawWorkflows
      .map((workflow, index) => {
        try {
          if (!validateWorkflow(workflow)) {
            errors.push(`Workflow ${index + 1}: Invalid structure`);
          }

          const normalized = normalizeWorkflow(workflow);
          return normalized;
        } catch (err) {
          errors.push(`Workflow ${index + 1}: Processing error`);
          return null;
        }
      })
      .filter(Boolean) as Workflow[];

    setValidationErrors(errors);
    return normalizedWorkflows;
  }, [rawWorkflows]);

  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflow) {
      const defaultWorkflow = workflows.find((w) => w.isDefault);
      const selected = defaultWorkflow || workflows[0];
      setSelectedWorkflow(selected);
    } else if (workflows.length === 0) {
      setSelectedWorkflow(null);
    }
  }, [workflows, selectedWorkflow]);

  const handleCreateWorkflow = useCallback(
    async (workflowData: CreateWorkflowData) => {
      try {
        setIsUpdating(true);

        const newWorkflow = await workflowsApi.createWorkflow(workflowData);

        if (onCreateWorkflow) {
          onCreateWorkflow(newWorkflow);
        }
        setShowCreateForm(false);

        if (onRefresh) {
          onRefresh();
        }

        return newWorkflow;
      } catch (error) {
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [onCreateWorkflow, onRefresh]
  );

  const handleDeleteWorkflow = useCallback(
    async (workflowId: string) => {
      const workflow = workflows.find((w) => w.id === workflowId);

      if (workflow?.isDefault) {
        return;
      }

      try {
        setIsUpdating(true);

        await workflowsApi.deleteWorkflow(workflowId);

        if (onDeleteWorkflow) {
          onDeleteWorkflow(workflowId);
        }

        if (selectedWorkflow?.id === workflowId) {
          const defaultWorkflow = workflows.find((w) => w.isDefault && w.id !== workflowId);
          const fallbackWorkflow = workflows.find((w) => w.id !== workflowId);
          const newSelected = defaultWorkflow || fallbackWorkflow || null;
          setSelectedWorkflow(newSelected);
        }

        if (onRefresh) {
          onRefresh();
        }
      } catch (error) {
      } finally {
        setIsUpdating(false);
        setWorkflowToDelete(null);
      }
    },
    [workflows, selectedWorkflow, onDeleteWorkflow, onRefresh]
  );

  const handleSetDefault = useCallback(
    async (workflowId: string) => {
      try {
        setIsUpdating(true);

        await workflowsApi.setAsDefaultWorkflow(workflowId, organizationId, currentUser?.id);

        if (onSetDefaultWorkflow) {
          onSetDefaultWorkflow(workflowId);
        }

        if (onRefresh) {
          onRefresh();
        }
      } catch (error) {
      } finally {
        setIsUpdating(false);
      }
    },
    [onSetDefaultWorkflow, onRefresh]
  );

  const handleUpdateStatus = useCallback(
    (statusId: string, updatedStatus: Partial<TaskStatus>) => {
      if (!selectedWorkflow) {
        return;
      }

      const updatedWorkflow = {
        ...selectedWorkflow,
        statuses: selectedWorkflow.statuses?.map((status) =>
          status.id === statusId ? { ...status, ...updatedStatus } : status
        ),
        _count: {
          statuses: selectedWorkflow.statuses?.length || 0,
          transitions: selectedWorkflow._count?.transitions ?? 0,
        },
      };

      setSelectedWorkflow(updatedWorkflow as Workflow);
    },
    [selectedWorkflow]
  );

  const handleCreateStatus = useCallback(
    (createdStatus: TaskStatus | any) => {
      if (!selectedWorkflow || !currentUser) {
        return;
      }

      const updatedWorkflow = {
        ...selectedWorkflow,
        statuses: [...(selectedWorkflow.statuses || []), createdStatus],
        _count: {
          statuses: (selectedWorkflow._count?.statuses || 0) + 1,
          transitions: selectedWorkflow._count?.transitions ?? 0,
        },
      };

      setSelectedWorkflow(updatedWorkflow as Workflow);
    },
    [selectedWorkflow, currentUser]
  );

  const handleDeleteStatus = useCallback(
    (statusId: string) => {
      if (!selectedWorkflow) {
        return;
      }

      const status = (selectedWorkflow.statuses || []).find((s) => s.id === statusId);
      if (!status) {
        return;
      }

      if (status?.isDefault) {
        return;
      }
      const updatedWorkflow = {
        ...selectedWorkflow,
        statuses: (selectedWorkflow.statuses || []).filter((s) => s.id !== statusId),
        _count: {
          statuses: (selectedWorkflow._count?.statuses || 0) - 1,
          transitions: selectedWorkflow._count?.transitions ?? 0,
        },
      };

      setSelectedWorkflow(updatedWorkflow as Workflow);
    },
    [selectedWorkflow]
  );

  useEffect(() => {
    const updatedWorkflows = workflows.map((w) => ({
      ...w,
      isDefault: w.isDefault || false,
    }));

    if (selectedWorkflow) {
      const updatedSelected = updatedWorkflows.find((w) => w.id === selectedWorkflow.id);
      if (updatedSelected) {
        setSelectedWorkflow(updatedSelected);
      }
    }
  }, [workflows]);

  const tabs = [
    { id: "overview", label: "Overview", icon: HiEye },
    { id: "editor", label: "Editor", icon: HiPencil },
    { id: "statuses", label: "Statuses", icon: HiCog },
  ];

  if (isLoading) {
    return <WorkFlowSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg">
        <div className="flex items-center gap-3">
          <HiExclamationTriangle className="w-5 h-5 text-[var(--destructive)] flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-[var(--destructive)] mb-1">
              Error loading workflows
            </h4>
            <p className="text-sm text-[var(--destructive)]/80">{error}</p>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200"
            >
              <HiArrowPath className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (validationErrors.length > 0 && workflows.length === 0) {
    return (
      <div className="p-4 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg">
        <div className="flex items-start gap-3">
          <HiExclamationTriangle className="w-5 h-5 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-[var(--destructive)] mb-2">
              Workflow Data Issues
            </h4>
            <ul className="text-sm text-[var(--destructive)]/80 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[var(--muted)] flex items-center justify-center">
          <HiViewGrid className="w-6 h-6 text-[var(--muted-foreground)]" />
        </div>
        <h3 className="text-md font-semibold text-[var(--foreground)] mb-2">No workflows found</h3>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          {isProjectLevel
            ? "Create your first workflow for this project."
            : "Create your first workflow template."}
        </p>
        <Button
          onClick={() => setShowCreateForm(true)}
          disabled={isUpdating}
          className="h-9 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium"
        >
          {isUpdating ? (
            <div className="w-4 h-4 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin mr-2"></div>
          ) : (
            <HiPlus className="w-4 h-4 mr-2" />
          )}
          Create Workflow
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end items-center">
        <Button
          onClick={() => setShowCreateForm(true)}
          disabled={isUpdating}
          className="h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium"
        >
          {isUpdating ? (
            <div className="w-4 h-4 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin mr-2"></div>
          ) : (
            <HiPlus className="w-4 h-4" />
          )}
          Create
        </Button>
      </div>

      {validationErrors.length > 0 && workflows.length > 0 && (
        <div className="p-3 bg-[var(--muted)]/50 border border-[var(--border)] rounded-lg">
          <div className="flex items-start gap-2">
            <HiExclamationTriangle className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                Some workflows have data issues:
              </p>
              <ul className="text-xs text-[var(--muted-foreground)] space-y-0.5">
                {validationErrors.slice(0, 3).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
                {validationErrors.length > 3 && (
                  <li>• ... and {validationErrors.length - 3} more issues</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <Card className="bg-[var(--sidebar)]  border-none shadow-sm">
            <CardHeader className="">
              <CardTitle className="text-sm font-semibold text-[var(--foreground)]">
                Workflows ({workflows.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {workflows.map((workflow) => {
                  const statusCount = workflow._count?.statuses || 0;
                  const transitionCount = workflow._count?.transitions || 0;

                  return (
                    <div
                      key={workflow.id}
                      className={`p-3 rounded-lg border-none cursor-pointer transition-all duration-200 ${
                        selectedWorkflow?.id === workflow.id
                          ? "border-[var(--primary)] bg-[var(--primary)]/5"
                          : "border-[var(--border)] hover:bg-[var(--accent)]"
                      }`}
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <h4 className="text-sm font-medium text-[var(--foreground)] truncate">
                          {workflow.name || "Unnamed Workflow"}
                        </h4>
                        {workflow.isDefault && (
                          <Badge className="bg-[var(--primary)]/10  text-[var(--primary)] border-none text-xs flex items-center gap-1">
                            <HiCheck className="w-3 h-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {statusCount} statuses • {transitionCount} transitions
                      </p>
                      {workflow.description && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-2 line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedWorkflow && (
            <>
              <div className="border-b border-[var(--border)] mb-4">
                <div className="flex gap-1">
                  {tabs.map((tab) => {
                    const IconComponent = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-2 border-b-2 text-sm font-medium transition-all duration-200 ease-in-out ${
                          isActive
                            ? "border-b-[var(--primary)] text-[var(--primary)]"
                            : "border-b-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <IconComponent className="size-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-[400px]">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <Card className="bg-[var(--sidebar)] border-none shadow-sm">
                      <CardContent>
                        <div className="flex justify-between  items-start">
                          <div>
                            <h3 className="text-md font-semibold text-[var(--foreground)] mb-2">
                              {selectedWorkflow.name || "Unnamed Workflow"}
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)] mb-3">
                              {selectedWorkflow.description || "No description provided"}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                              <span>
                                Created:{" "}
                                {selectedWorkflow.createdAt
                                  ? new Date(selectedWorkflow.createdAt).toLocaleDateString()
                                  : "Unknown"}
                              </span>
                              <span>
                                Updated:{" "}
                                {selectedWorkflow.updatedAt
                                  ? new Date(selectedWorkflow.updatedAt).toLocaleDateString()
                                  : "Unknown"}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!selectedWorkflow.isDefault && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetDefault(selectedWorkflow.id)}
                                disabled={isUpdating}
                                className="h-8 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200"
                              >
                                <Check className="w-3 h-3" />
                                Set as Default
                              </Button>
                            )}
                            {!selectedWorkflow.isDefault && (
                              <Tooltip content="Delete workflow" position="top" color="primary">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setWorkflowToDelete(selectedWorkflow.id)}
                                  disabled={isUpdating}
                                  className="h-8 border-none bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/20 text-[var(--destructive)] transition-all duration-200"
                                >
                                  <HiTrash className="w-3 h-3" />
                                </Button>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-[var(--sidebar)]  border-none shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md font-semibold text-[var(--foreground)]">
                          Status Flow
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {selectedWorkflow.statuses && selectedWorkflow.statuses.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-3">
                            {(selectedWorkflow.statuses as TaskStatus[])
                              .sort((a, b) => (a.position || 0) - (b.position || 0))
                              .map((status, index) => (
                                <React.Fragment key={status.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full border border-[var(--border)]"
                                      style={{
                                        backgroundColor: status.color || "#gray",
                                      }}
                                    />
                                    <div>
                                      <div className="text-sm font-medium text-[var(--foreground)]">
                                        {status.name || "Unnamed Status"}
                                      </div>
                                    </div>
                                  </div>
                                  {selectedWorkflow.statuses &&
                                    index < selectedWorkflow.statuses.length - 1 && (
                                      <HiChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
                                    )}
                                </React.Fragment>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--muted-foreground)]">
                            No statuses configured for this workflow.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "editor" && (
                  <WorkflowEditor
                    workflow={selectedWorkflow}
                    onUpdate={(updatedWorkflow) => {
                      setSelectedWorkflow(updatedWorkflow);
                    }}
                    isUpdating={isUpdating}
                  />
                )}

                {activeTab === "statuses" && (
                  <StatusConfiguration
                    workflow={{
                      ...selectedWorkflow,
                      statuses: (selectedWorkflow.statuses || []).map((s: any) => ({
                        ...s,
                        order: s.position ?? 0,
                      })),
                    }}
                    onUpdateStatus={handleUpdateStatus}
                    onCreateStatus={(newStatus) => {
                      if (typeof newStatus === "object" && newStatus !== null) {
                        handleCreateStatus({
                          name: (newStatus as any).name ?? "",
                          category: (newStatus as any).category ?? "TODO",
                          position: (newStatus as any).position ?? 0,
                          color: (newStatus as any).color ?? "#64748b",
                          isDefault: (newStatus as any).isDefault ?? false,
                          workflowId: selectedWorkflow.id,
                        });
                      }
                    }}
                    onDeleteStatus={handleDeleteStatus}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <CreateWorkflowForm
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSuccess={async (workflowData) => {
          const result = await handleCreateWorkflow(workflowData);
          return result;
        }}
        organizationId={organizationId || currentOrganization?.id || ""}
        isProjectLevel={isProjectLevel}
        isLoading={isUpdating}
      />

      <ConfirmationModal
        isOpen={!!workflowToDelete}
        onClose={() => setWorkflowToDelete(null)}
        onConfirm={() => handleDeleteWorkflow(workflowToDelete!)}
        title="Delete Workflow"
        message="Are you sure you want to delete this workflow? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
