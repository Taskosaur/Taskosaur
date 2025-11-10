import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import ActionButton from "@/components/common/ActionButton";
import {
  HiExclamationTriangle,
  HiTrash,
  HiArchiveBox,
  HiPencil,
  HiEllipsisHorizontal,
} from "react-icons/hi2";

// Types
interface EntityInfo {
  type: "organization" | "workspace" | "project" | "task";
  name: string;
  displayName?: string;
}

interface ActionConfig {
  name: string;
  type: "delete" | "archive" | "edit" | "transfer" | "custom";
  label: string;
  description: string;
  confirmationMessage?: string;
  requiresNameConfirmation?: boolean;
  handler: (entityName?: string) => Promise<void>;
  variant?: "destructive" | "warning" | "default";
}

interface DangerZoneModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerText?: string;
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  entity: EntityInfo;
  actions: ActionConfig[];
  title?: string;
  description?: string;
  onRetry?: () => void;
}

// Action type to icon mapping
const getActionIcon = (type: string) => {
  switch (type) {
    case "delete":
      return HiTrash;
    case "archive":
      return HiArchiveBox;
    case "edit":
      return HiPencil;
    default:
      return HiEllipsisHorizontal;
  }
};

// Action type to color mapping
const getActionVariant = (variant?: string) => {
  switch (variant) {
    case "destructive":
      return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30";
    case "warning":
      return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/30";
    default:
      return "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800/30";
  }
};

export default function DangerZoneModal({
  children,
  open,
  onOpenChange,
  triggerText = "Danger Zone",
  triggerVariant = "destructive",
  entity,
  actions,
  title,
  description,
  onRetry,
}: DangerZoneModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionConfig | null>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use controlled open state if provided, otherwise use internal state
  const dialogOpen = open !== undefined ? open : isOpen;
  const setDialogOpen = onOpenChange || setIsOpen;

  const entityDisplayName = entity.displayName || entity.name;
  const confirmationText =
    selectedAction?.confirmationMessage ||
    `Type **${entity.name}** to confirm ${selectedAction?.name || "action"}`;

  const resetForm = useCallback(() => {
    setSelectedAction(null);
    setConfirmationInput("");
    setError(null);
    setIsSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
        setTimeout(resetForm, 300);
      }
    },
    [setDialogOpen, resetForm]
  );

  const retryAction = useCallback(() => {
    setError(null);
    setIsSubmitting(false);
    setConfirmationInput("");
    if (onRetry) onRetry();
  }, [onRetry]);

  const handleActionSelect = useCallback((action: ActionConfig) => {
    setSelectedAction(action);
    setConfirmationInput("");
    setError(null);
  }, []);

  const handleBackToActions = useCallback(() => {
    setSelectedAction(null);
    setConfirmationInput("");
    setError(null);
  }, []);

  const handleConfirmationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmationInput(e.target.value);
      if (error) setError(null);
    },
    [error]
  );

  const isConfirmationValid = useCallback(() => {
    if (!selectedAction) return false;

    if (selectedAction.requiresNameConfirmation !== false) {
      return confirmationInput.trim() === entity.name;
    }

    return true;
  }, [selectedAction, confirmationInput, entity.name]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedAction || !isConfirmationValid()) {
        setError(`Please type "${entity.name}" exactly to confirm`);
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await selectedAction.handler();
        toast.success(`${entity.type} ${selectedAction.name}d successfully!`);
        handleOpenChange(false);

        // After organization deletion, simply reload the page
        // OrganizationSelector will handle selecting the new organization
        if (entity.type === "organization" && selectedAction.type === "delete") {
          window.location.href = "/dashboard";
        }
      } catch (error) {
        const errMsg =
          error instanceof Error
            ? error.message
            : `Failed to ${selectedAction.name} ${entity.type}`;
        setError(errMsg);
        toast.error(errMsg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedAction, isConfirmationValid, entity, handleOpenChange]
  );

  const modalTitle =
    title || `${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)} Danger Zone`;
  const modalDescription = description || `Perform destructive actions on ${entityDisplayName}`;

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || <Button className="bg-red-700">{triggerText}</Button>}
      </DialogTrigger>

      <DialogContent className="projects-modal-container border-none">
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--destructive)]">
              <HiExclamationTriangle className="projects-modal-icon-content" />
            </div>
            <div className="projects-modal-info">
              <DialogTitle className="projects-modal-title">{modalTitle}</DialogTitle>
              <DialogDescription className="projects-modal-description">
                {modalDescription}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!selectedAction ? (
          // Actions List View
          <div className="space-y-4">
            <div className="text-sm text-[var(--muted-foreground)] mb-4">
              Select an action to perform on <strong>{entityDisplayName}</strong>:
            </div>

            <div className="space-y-3">
              {actions.map((action) => {
                const IconComponent = getActionIcon(action.type);
                const variantClass = getActionVariant(action.variant);

                return (
                  <div
                    key={action.name}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:bg-opacity-80 ${variantClass}`}
                    onClick={() => handleActionSelect(action)}
                  >
                    <div className="flex items-start gap-3">
                      <IconComponent className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-medium text-[var(--foreground)]">{action.label}</h4>
                        <p className="text-sm text-[var(--muted-foreground)] mt-1">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="projects-form-actions flex gap-2 justify-end mt-6">
              <ActionButton secondary onClick={() => handleOpenChange(false)}>
                Cancel
              </ActionButton>
            </div>
          </div>
        ) : (
          // Confirmation View
          <form onSubmit={handleSubmit} className="projects-modal-form">
            <div className="space-y-4">
              {/* Selected Action Info */}
              <div className={`p-4 rounded-lg border ${getActionVariant(selectedAction.variant)}`}>
                <div className="flex items-center gap-3">
                  {React.createElement(getActionIcon(selectedAction.type), {
                    className: "w-5 h-5 flex-shrink-0",
                  })}
                  <div>
                    <h4 className="font-medium text-[var(--foreground)]">{selectedAction.label}</h4>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {selectedAction.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Input */}
              {selectedAction.requiresNameConfirmation !== false && (
                <div className="projects-form-field">
                  <Label htmlFor="confirmation" className="projects-form-label">
                    <HiExclamationTriangle
                      className="projects-form-label-icon"
                      style={{ color: "var(--destructive)" }}
                    />
                    Confirmation <span className="projects-form-label-required">*</span>
                  </Label>
                  <div className="space-y-2">
                    <div
                      className="text-sm text-[var(--muted-foreground)]"
                      dangerouslySetInnerHTML={{
                        __html: confirmationText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                      }}
                    />
                    <Input
                      id="confirmation"
                      placeholder={entity.name}
                      value={confirmationInput}
                      onChange={handleConfirmationChange}
                      className="projects-form-input border-none"
                      style={{
                        borderColor: "var(--destructive)",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--destructive)";
                        e.target.style.boxShadow = `0 0 0 3px var(--destructive)/20`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--destructive)";
                        e.target.style.boxShadow = "none";
                      }}
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="projects-form-actions flex gap-2 justify-end mt-6">
              <ActionButton
                type="button"
                secondary
                onClick={handleBackToActions}
                disabled={isSubmitting}
              >
                Back
              </ActionButton>
              <ActionButton
                type="submit"
                className="bg-[var(--destructive)] hover:bg-[var(--destructive)]/90 text-white"
                disabled={!isConfirmationValid() || isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 capitalize border-white border-t-transparent rounded-full" />
                    <span>{selectedAction.name}ing...</span>
                  </div>
                ) : (
                  `${selectedAction.label}`
                )}
              </ActionButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
