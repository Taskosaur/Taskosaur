import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { HiCog, HiSparkles, HiDocumentText, HiExclamationTriangle } from "react-icons/hi2";
import ActionButton from "@/components/common/ActionButton";
import { CreateWorkflowData, Workflow } from "@/types";

interface CreateWorkflowFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (workflowData: CreateWorkflowData) => Promise<Workflow>;
  organizationId: string;
  isProjectLevel?: boolean;
  isLoading?: boolean;
}

export default function CreateWorkflowForm({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  isProjectLevel = false,
  isLoading = false,
}: CreateWorkflowFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isDefault: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Workflow name is required";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Workflow name must be at least 3 characters";
    } else if (formData.name.trim().length > 50) {
      newErrors.name = "Workflow name must be less than 50 characters";
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(formData.name.trim())) {
      newErrors.name =
        "Workflow name can only contain letters, numbers, spaces, hyphens, and underscores";
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = "Description must be less than 200 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const workflowData: CreateWorkflowData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        organizationId,
        isDefault: formData.isDefault || false,
      };

      await onSuccess(workflowData);
      handleClose();
    } catch (err) {
      console.error("Failed to create workflow:", err);
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;

    setFormData({
      name: "",
      description: "",
      isDefault: false,
    });
    setErrors({});
    setError(null);
    onClose();
  };

  const isValid = formData.name.trim().length >= 3 && organizationId;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="projects-modal-container border-none">
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--primary)]">
              <HiCog className="projects-modal-icon-content" />
            </div>
            <div className="projects-modal-info">
              <DialogTitle className="projects-modal-title">
                Create {isProjectLevel ? "project" : ""} workflow
              </DialogTitle>
              <DialogDescription className="projects-modal-description">
                {isProjectLevel
                  ? "Create a new workflow for this project to define task statuses and flow"
                  : "Create a new workflow template for use across multiple projects"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="projects-modal-form">
          {/* Error Alert */}
          {error && (
            <Alert
              variant="destructive"
              className="bg-[var(--destructive)]/10 border-[var(--destructive)]/20 text-[var(--destructive)]"
            >
              <HiExclamationTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Workflow Name */}
          <div className="projects-form-field">
            <Label htmlFor="name" className="projects-form-label">
              <HiSparkles
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Workflow name <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Development Workflow, Bug Triage Process"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="projects-form-input border-none"
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
              disabled={isSubmitting || isLoading}
            />
            <p className="projects-form-hint">
              <HiSparkles
                className="projects-form-hint-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Choose a clear, descriptive name for your workflow.
            </p>
            {errors.name && <p className="text-sm text-[var(--destructive)] mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="projects-form-field">
            <Label htmlFor="description" className="projects-form-label">
              <HiDocumentText
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose and usage of this workflow..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="projects-form-textarea border-none"
              rows={3}
              onFocus={(e) => {
                e.target.style.boxShadow = "none";
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = "none";
              }}
              disabled={isSubmitting || isLoading}
            />
            <p className="projects-form-hint">
              <HiDocumentText
                className="projects-form-hint-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Provide context about when and how this workflow should be used.
            </p>
            {errors.description && (
              <p className="text-sm text-[var(--destructive)] mt-1">{errors.description}</p>
            )}
          </div>

          {/* Set as Default */}
          <div className="projects-form-field">
            <div className="flex items-start space-x-3 rounded-md border border-[var(--border)] p-4 bg-[var(--muted)]/30">
              <Checkbox
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isDefault: checked as boolean }))
                }
                disabled={isSubmitting || isLoading}
                className="border-[var(--border)] mt-1"
              />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="isDefault"
                  className="text-[var(--foreground)] font-medium cursor-pointer"
                >
                  Set as default workflow
                </Label>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {isProjectLevel
                    ? "This workflow will be used by default for new tasks in this project"
                    : "This workflow will be used by default for new projects in your organization"}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="projects-form-actions flex gap-2 justify-end mt-6">
            <ActionButton
              type="button"
              secondary
              onClick={handleClose}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </ActionButton>
            <ActionButton type="submit" primary disabled={!isValid || isSubmitting || isLoading}>
              {isSubmitting || isLoading ? (
                <>
                  <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating...
                </>
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
