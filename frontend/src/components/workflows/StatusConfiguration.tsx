import React, { useState } from "react";
import { Badge, Button, Input, Select, Textarea } from "@/components/ui";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { taskStatusApi } from "@/utils/api/taskStatusApi";
import { CreateTaskStatusDto, StatusCategory, TaskStatus, Workflow } from "@/types";
import Tooltip from "../common/ToolTip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface StatusConfigurationProps {
  workflow: Workflow;
  onUpdateStatus: (statusId: string, updatedStatus: Partial<TaskStatus>) => void;
  onCreateStatus: (newStatus: TaskStatus) => void;
  onDeleteStatus: (statusId: string) => void;
}
export default function StatusConfiguration({
  workflow,
  onCreateStatus,
  onDeleteStatus,
}: StatusConfigurationProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<TaskStatus | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#64748b",
    category: "TODO",
    order: 1,
  });

  const predefinedColors = [
    "#64748b",
    "#ef4444",
    "#f59e0b",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f97316",
  ];

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: "#64748b",
      category: "TODO",
      order: 1,
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    try {
      setIsCreating(true);
      const statuses = Array.isArray(workflow.statuses) ? workflow.statuses : [];
      const maxPosition = Math.max(...statuses.map((s) => s.position || 0), 0);

      const createStatusData: CreateTaskStatusDto = {
        name: formData.name.trim(),
        color: formData.color,
        category: formData.category as "TODO" | "IN_PROGRESS" | "DONE",
        position: maxPosition + 1,
        workflowId: workflow.id,
      };
      const createdStatus = await taskStatusApi.createTaskStatus(createStatusData);

      onCreateStatus(createdStatus);
      setShowCreateModal(false);
      resetForm();

      toast.success("Status created successfully");
    } catch (error: any) {
      let errorMessage = "Failed to create status";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response?.data?.message
      ) {
        errorMessage = error.response.data.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (status: TaskStatus) => {
    onDeleteStatus(status.id);
    setShowDeleteModal(null);
  };

  const getCategoryColor = (category: StatusCategory) => {
    switch (category) {
      case StatusCategory.TODO:
        return "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]";
      case StatusCategory.IN_PROGRESS:
        return "bg-blue-100 text-blue-700 border-[var(--border)]";
      case StatusCategory.DONE:
        return "bg-green-100 text-green-900 border-[var(--border)]";
      default:
        return "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]";
    }
  };

  const statuses = Array.isArray(workflow.statuses) ? workflow.statuses : [];
  const sortedStatuses = [...statuses].sort((a, b) => (a.position || 0) - (b.position || 0));

  const toTaskStatus = (status: any): TaskStatus => ({
    id: status.id,
    name: status.name,
    color: status.color,
    category: status.category,
    order: 1,
    description: typeof status.description === "string" ? status.description : "",
    isDefault: !!status.isDefault,
    workflowId: status.workflowId ?? "",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-md font-semibold text-[var(--foreground)]">Status Configuration</h3>
          <p className="text-[var(--muted-foreground)] text-sm">
            Manage individual statuses for {workflow.name}
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="h-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <p className="hidden md:flex">Add Status</p>
        </Button>
      </div>

      {/* Status List */}
      <div className="bg-[var(--sidebar)] rounded-lg shadow-sm border border-none overflow-x-auto">
        <div className="min-w-max">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--border)] bg-[var(--muted)] text-sm font-medium">
            <div className="col-span-3">Status</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-1">Order</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-2">Actions</div>
          </div>
          {/* Body */}
          <div className="divide-y divide-[var(--border)]">
            {sortedStatuses.map((status) => (
              <div key={status.id} className="px-4 py-4">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm text-[var(--foreground)] truncate">
                          {status.name}
                          {status.isDefault && (
                            <span className="text-xs ml-2 bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)] p-1 px-2 rounded-lg">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Badge
                      className={`inline-block px-2 py-1 text-xs rounded-full border-none whitespace-nowrap ${getCategoryColor(
                        (status?.category ?? StatusCategory.TODO) as StatusCategory
                      )}`}
                      variant="secondary"
                    >
                      {status?.category && status.category === "IN_PROGRESS"
                        ? "IN PROGRESS"
                        : (status.category ?? StatusCategory.TODO)}
                    </Badge>
                  </div>
                  <div className="col-span-1">
                    <span className="text-sm text-[var(--foreground)]">
                      {status.position ?? ""}
                    </span>
                  </div>
                  <div className="col-span-4">
                    <p className="text-sm text-[var(--foreground)] line-clamp-2">
                      {typeof (status as any).description === "string" &&
                      (status as any).description.trim()
                        ? (status as any).description
                        : "No description"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center space-x-2">
                      {!status.isDefault && (
                        <Tooltip content="Delete" position="top" color="danger">
                          <button
                            onClick={() => setShowDeleteModal(toTaskStatus(status))}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Dialog
          open={showCreateModal}
          onOpenChange={(open) => {
            setShowCreateModal(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="w-full max-w-[90vw] sm:max-w-[600px] bg-[var(--card)] border-none shadow-lg">
            <DialogHeader>
              <DialogTitle>Create New Status</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-10 border-input bg-background text-[var(--foreground)]"
                  placeholder="Status name"
                  disabled={isCreating}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="border-input bg-background text-[var(--foreground)]"
                  placeholder="Status description"
                  disabled={isCreating}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Category <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: value as StatusCategory,
                    }))
                  }
                  disabled={isCreating}
                >
                  <SelectTrigger className="w-full px-3 border border-[var(--border)] input-selection dark-input-background focus-ring">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--card)] border border-[var(--border)]">
                    <SelectItem value={StatusCategory.TODO}>To Do</SelectItem>
                    <SelectItem value={StatusCategory.IN_PROGRESS}>In Progress</SelectItem>
                    <SelectItem value={StatusCategory.DONE}>Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Color <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        color: e.target.value,
                      }))
                    }
                    className="w-12 h-8 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                    disabled={isCreating}
                  />
                  <div className="flex space-x-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => !isCreating && setFormData((prev) => ({ ...prev, color }))}
                        className={`w-6 h-6 rounded-full border-2 ${
                          formData.color === color
                            ? "border-gray-900 dark:border-white"
                            : "border-gray-300 dark:border-gray-600"
                        } ${isCreating ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                        style={{ backgroundColor: color }}
                        disabled={isCreating}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-end space-x-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleCreate}
                disabled={!formData.name.trim() || isCreating}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium"
              >
                {isCreating ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  "Create Status"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setShowDeleteModal(null)}
          onConfirm={() => handleDelete(showDeleteModal)}
          title="Delete Status"
          message={`Are you sure you want to delete the status "${showDeleteModal.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  );
}
