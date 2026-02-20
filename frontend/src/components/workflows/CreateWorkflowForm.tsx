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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("settings");
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
      newErrors.name = t("create_workflow.name_required");
    } else if (formData.name.trim().length < 3) {
      newErrors.name = t("create_workflow.name_min");
    } else if (formData.name.trim().length > 50) {
      newErrors.name = t("create_workflow.name_max");
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(formData.name.trim())) {
      newErrors.name =
        t("create_workflow.name_chars");
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = t("create_workflow.desc_max");
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
        throw new Error(t("create_workflow.org_id_required"));
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
      setError(err instanceof Error ? err.message : t("create_workflow.create_failed"));
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
                {t("create_workflow.title", { level: isProjectLevel ? "project" : "" })}
              </DialogTitle>
              <DialogDescription className="projects-modal-description">
                {isProjectLevel
                  ? t("create_workflow.desc_project")
                  : t("create_workflow.desc_org")}
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
              {t("create_workflow.name_label")} <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t("create_workflow.name_placeholder")}
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
              {t("create_workflow.name_hint")}
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
              {t("create_workflow.desc_label")}
            </Label>
            <Textarea
              id="description"
              placeholder={t("create_workflow.desc_placeholder")}
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
              {t("create_workflow.desc_hint")}
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
                  {t("create_workflow.set_default_label")}
                </Label>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {isProjectLevel
                    ? t("create_workflow.set_default_project")
                    : t("create_workflow.set_default_org")}
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
              {t("create_workflow.cancel")}
            </ActionButton>
            <ActionButton type="submit" primary disabled={!isValid || isSubmitting || isLoading}>
              {isSubmitting || isLoading ? (
                <>
                  <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  {t("create_workflow.creating")}
                </>
              ) : (
                t("create_workflow.create")
              )}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
