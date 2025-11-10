import React, { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/organization-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Play,
  ArrowRight,
  GripVertical,
  RotateCcw,
  Save,
  Edit3,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { StatusCategory, TaskStatus, Workflow } from "@/types";
import { toast } from "sonner";
import ConfirmationModal from "../modals/ConfirmationModal";
import Tooltip from "../common/ToolTip";
interface WorkflowEditorProps {
  workflow: Workflow;
  onUpdate: (workflow: any) => void;
  isUpdating?: boolean;
}

interface WorkflowDetailsFormData {
  name: string;
  description: string;
  isDefault: boolean;
}

export default function WorkflowEditor({
  workflow,
  onUpdate,
  isUpdating = false,
}: WorkflowEditorProps) {
  const { updateWorkflow, updateTaskStatusPositions } = useOrganization();
  const [draggedStatus, setDraggedStatus] = useState<TaskStatus | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsFormData, setDetailsFormData] = useState<WorkflowDetailsFormData>({
    name: workflow.name,
    description: workflow.description || "",
    isDefault: workflow.isDefault,
  });
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({});
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [hasStatusChanges, setHasStatusChanges] = useState(false);
  const [isSavingStatuses, setIsSavingStatuses] = useState(false);
  const [resetToDefaultConfirmation, setResetToDefaultConfirmation] = useState(false);

  useEffect(() => {
    setDetailsFormData({
      name: workflow.name,
      description: workflow.description || "",
      isDefault: workflow.isDefault,
    });
  }, [workflow]);

  const handleDragStart = (e: React.DragEvent, status: TaskStatus) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedStatus(status);
  };

  const handleDragEnd = () => {
    setDraggedStatus(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (!draggedStatus) return;

    const currentIndex = workflow.statuses
      ? workflow.statuses.findIndex((s) => s.id === draggedStatus.id)
      : 0;
    if (currentIndex === targetIndex) return;

    const newStatuses = [...(workflow.statuses ?? [])];
    const [movedStatus] = newStatuses.splice(currentIndex, 1);
    newStatuses.splice(targetIndex, 0, movedStatus);

    const updatedStatuses = newStatuses.map((status, index) => ({
      ...status,
      position: index,
      order: index + 1,
    }));

    const updatedWorkflow = {
      ...workflow,
      statuses: updatedStatuses,
    };

    onUpdate(updatedWorkflow);
    setHasStatusChanges(true);
    setDragOverIndex(null);
  };

  const handleResetToDefault = () => {
    const categoryOrder: Record<StatusCategory, number> = {
      TODO: 1,
      IN_PROGRESS: 2,
      DONE: 3,
    };

    const resetStatuses = [...(workflow.statuses ?? [])]
      .sort((a, b) => {
        const aCat = a.category ?? "TODO";
        const bCat = b.category ?? "TODO";
        const aPriority = categoryOrder[aCat as StatusCategory] ?? 999;
        const bPriority = categoryOrder[bCat as StatusCategory] ?? 999;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return (a.name ?? "").localeCompare(b.name ?? "");
      })
      .map((status, index) => ({
        ...status,
        position: index,
        order: index + 1,
      }));

    const updatedWorkflow = {
      ...workflow,
      statuses: resetStatuses,
    };

    onUpdate(updatedWorkflow);
    setHasStatusChanges(true);
    setResetToDefaultConfirmation(false);
  };

  const handleSaveStatusOrder = async () => {
    try {
      setIsSavingStatuses(true);

      const statusUpdates = sortedStatuses.map((status, index) => ({
        id: status.id,
        position: index,
      }));

      const updatedStatuses = await updateTaskStatusPositions(statusUpdates);

      const updatedWorkflow = {
        ...workflow,
        statuses: updatedStatuses,
      };

      onUpdate(updatedWorkflow);
      setHasStatusChanges(false);
      toast.success("Status order updated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save status order");
    } finally {
      setIsSavingStatuses(false);
    }
  };

  const validateDetailsForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!detailsFormData.name.trim()) {
      errors.name = "Workflow name is required";
    } else if (detailsFormData.name.trim().length < 3) {
      errors.name = "Workflow name must be at least 3 characters";
    } else if (detailsFormData.name.trim().length > 50) {
      errors.name = "Workflow name must be less than 50 characters";
    }

    if (detailsFormData.description && detailsFormData.description.length > 200) {
      errors.description = "Description must be less than 200 characters";
    }

    setDetailsErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDetails = async () => {
    if (!validateDetailsForm()) {
      return;
    }

    try {
      setIsSavingDetails(true);

      const updateData = {
        name: detailsFormData.name.trim(),
        description: detailsFormData.description.trim() || undefined,
        isDefault: detailsFormData.isDefault,
      };

      const updatedWorkflow = await updateWorkflow(workflow.id, updateData);

      onUpdate({ ...updatedWorkflow, statuses: workflow.statuses || [] });
      setIsEditingDetails(false);

      toast.success("Workflow details updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update workflow details");
      console.error("Failed to update workflow details:", error);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleCancelDetailsEdit = () => {
    setDetailsFormData({
      name: workflow.name,
      description: workflow.description || "",
      isDefault: workflow.isDefault,
    });
    setDetailsErrors({});
    setIsEditingDetails(false);
  };

  const sortedStatuses = Array.isArray(workflow.statuses)
    ? [...workflow.statuses].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];

  return (
    <div className="space-y-4">
      {/* Workflow Details Section */}
      <Card className="bg-[var(--sidebar)] border-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-md font-semibold text-[var(--foreground)]">
            Workflow Details
          </CardTitle>
          {!isEditingDetails && (
            <Tooltip content="Edit details" position="top" color="primary">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingDetails(true)}
                disabled={isUpdating}
                className="flex items-center gap-2 bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingDetails ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[var(--foreground)]">
                  Workflow Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={detailsFormData.name}
                  onChange={(e) =>
                    setDetailsFormData({
                      ...detailsFormData,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter workflow name"
                  disabled={isSavingDetails}
                  className="bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]"
                />
                {detailsErrors.name && (
                  <p className="text-sm text-[var(--destructive)]">{detailsErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-[var(--foreground)]">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={detailsFormData.description}
                  onChange={(e) =>
                    setDetailsFormData({
                      ...detailsFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Enter workflow description"
                  disabled={isSavingDetails}
                  className="bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] min-h-[80px]"
                  rows={3}
                />
                {detailsErrors.description && (
                  <p className="text-sm text-[var(--destructive)]">{detailsErrors.description}</p>
                )}
              </div>

              {/* Default Workflow */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={detailsFormData.isDefault}
                  onCheckedChange={(checked) =>
                    setDetailsFormData({
                      ...detailsFormData,
                      isDefault: checked as boolean,
                    })
                  }
                  disabled={isSavingDetails}
                  className="border-[var(--border)] cursor-pointer"
                />
                <Label htmlFor="isDefault" className="text-[var(--foreground)] cursor-pointer">
                  Set as default workflow
                </Label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSaveDetails}
                  disabled={isSavingDetails}
                  className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90"
                >
                  {isSavingDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Details
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelDetailsEdit}
                  disabled={isSavingDetails}
                  className="bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-md font-medium text-[var(--foreground)]">{workflow.name}</h3>
                  {workflow.isDefault && (
                    <Badge
                      variant="default"
                      className="bg-[var(--primary)] text-[var(--primary-foreground)]"
                    >
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-[var(--muted-foreground)] text-sm">
                  {workflow.description || "No description provided"}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                <span>Statuses: {workflow.statuses ? workflow.statuses.length : 0}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Changes Alert */}
      {hasStatusChanges && (
        <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-800" />
          <AlertDescription className="text-yellow-600">
            You have unsaved changes to the status order. Don't forget to save your changes.
          </AlertDescription>
        </Alert>
      )}
      {/* Workflow Visual */}
      <Card className="bg-[var(--sidebar)] border-none p-6">
        {sortedStatuses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <Play className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No Statuses Configured
            </h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Add statuses to this workflow to create a visual flow.
            </p>
          </div>
        ) : (
          <div>
            <div className="block mb-2 md:flex items-center gap-2 justify-between ">
              <h3 className="text-md font-semibold text-[var(--foreground)]">
                Visual Status Flow Editor
              </h3>
              <div className="flex gap-2">
                <Tooltip content="Reset to Default" position="top" color="primary">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetToDefaultConfirmation(true)}
                    disabled={
                      isUpdating ||
                      isSavingStatuses ||
                      !Array.isArray(workflow.statuses) ||
                      workflow.statuses.length === 0
                    }
                    className="flex items-center gap-2 bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </Tooltip>
                {hasStatusChanges && (
                  <Button
                    onClick={handleSaveStatusOrder}
                    disabled={isSavingStatuses || isUpdating}
                    className="h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90  transition-all duration-200 font-medium"
                    variant="outline"
                  >
                    {isSavingStatuses ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Order
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[var(--muted-foreground)] text-sm mb-4">
              Drag and drop statuses to reorder them. The order defines the typical flow of tasks
              through your workflow.
            </p>
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-4 min-w-max">
                {sortedStatuses.map((status, index) => {
                  const safeCategory = (status.category ?? "TODO") as StatusCategory;
                  const safePosition = typeof status.position === "number" ? status.position : 0;
                  const safeStatus: TaskStatus = {
                    ...status,
                    category: safeCategory,
                    position: safePosition,
                    isDefault: !!status.isDefault,
                    workflowId: status.workflowId ?? "",
                    createdAt: status.createdAt ?? "",
                    updatedAt: status.updatedAt ?? "",
                  };
                  return (
                    <React.Fragment key={status.id}>
                      <div
                        className={`flex-shrink-0 w-48 sm:w-56 md:w-64 p-4 border-2 border-dashed rounded-lg cursor-move transition-all ${
                          dragOverIndex === index
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]"
                        } ${
                          draggedStatus?.id === status.id ? "opacity-50 rotate-1 scale-105" : ""
                        }`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, safeStatus)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        {/* Status Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div
                              className="w-4 h-4 rounded-full border border-[var(--border)] flex-shrink-0"
                              style={{ backgroundColor: status.color }}
                            />
                            <span className="font-medium text-[var(--foreground)] truncate text-sm sm:text-base">
                              {status.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                            <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                              #{safePosition}
                            </span>
                            <GripVertical className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--muted-foreground)]" />
                          </div>
                        </div>

                        {/* Status Details */}
                        <div className="space-y-2 pt-6">
                          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                            <span>{status.isDefault ? "Default" : "Custom"}</span>
                            <div className="hidden sm:flex items-center space-x-1">
                              <GripVertical className="w-3 h-3" />
                              <span className="hidden md:inline">Drag to reorder</span>
                              <span className="md:hidden">Drag</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      {index < sortedStatuses.length - 1 && (
                        <div className="flex-shrink-0 flex items-center justify-center w-6 sm:w-8 h-full min-h-[120px]">
                          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[var(--muted-foreground)]" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Workflow Rules */}
      <Card className="bg-[var(--sidebar)] border-none p-6">
        <h3 className="text-md font-semibold text-[var(--foreground)] mb-4">Workflow Rules</h3>
        <div className="space-y-4">
          <div className="p-4 bg-[var(--category-blue-10)] rounded-lg border-none">
            <h4 className="font-medium text-[var(--category-blue)] mb-2">Transition Rules</h4>
            <ul className="text-sm text-[var(--category-blue-light)] space-y-1">
              <li>• Tasks can move forward to any subsequent status</li>
              <li>• Tasks can move backward to previous statuses</li>
              <li>• Some transitions may require specific permissions</li>
              <li>• Automated transitions can be configured for certain conditions</li>
            </ul>
          </div>

          <div className="p-4 bg-[var(--category-lime-10)] rounded-lg border-none">
            <h4 className="font-medium text-[var(--category-lime)] mb-2">Status Requirements</h4>
            <ul className="text-sm text-[var(--category-lime-light)] space-y-1">
              <li>• At least one status must be marked as default</li>
              <li>• Each workflow must have at least one status in each category</li>
              <li>• Status names must be unique within a workflow</li>
              <li>• Default status cannot be deleted</li>
            </ul>
          </div>
        </div>
      </Card>

      <ConfirmationModal
        isOpen={resetToDefaultConfirmation}
        onClose={() => setResetToDefaultConfirmation(false)}
        onConfirm={() => handleResetToDefault()}
        title="Reset to default"
        message="Are you sure you want to reset the workflow to default order? This will undo any custom ordering."
        confirmText="Reset to default"
        cancelText="Cancel"
      />
    </div>
  );
}
