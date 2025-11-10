import { useState, useCallback } from "react";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { HiExclamationTriangle, HiSparkles, HiDocumentText } from "react-icons/hi2";
import { HiBuildingOffice2 } from "react-icons/hi2";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import ActionButton from "../common/ActionButton";

interface FormData {
  name: string;
  description: string;
}

interface NewWorkspaceDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerText?: string;
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onWorkspaceCreated?: () => Promise<void>;
  refetchWorkspaces?: () => Promise<void>;
}

export default function NewWorkspaceDialog({
  children,
  open,
  onOpenChange,
  triggerText = "New Workspace",
  triggerVariant = "default",
  onWorkspaceCreated,
}: NewWorkspaceDialogProps) {
  const workspaceContext = useWorkspaceContext();
  const { isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
  });

  const dialogOpen = open !== undefined ? open : isOpen;
  const setDialogOpen = onOpenChange || setIsOpen;

  const isFormValid = useCallback(() => {
    return formData.name.trim() !== "" && formData.description.trim() !== "";
  }, [formData]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (error) setError(null);
    },
    [error]
  );

  const resetForm = useCallback(() => {
    setFormData({ name: "", description: "" });
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!workspaceContext) {
        setError("Workspace context not available");
        return;
      }

      if (!isFormValid()) {
        setError("Please fill in all required fields");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        if (!isAuthenticated()) {
          throw new Error("Authentication required");
        }

        await workspaceContext.createWorkspace({
          name: formData.name.trim(),
          description: formData.description.trim(),
        });

        if (onWorkspaceCreated) {
          try {
            await onWorkspaceCreated();
          } catch (refreshError) {
            console.error("Failed to refresh workspaces:", refreshError);
            toast.warning("Workspace created but failed to refresh list. Please refresh the page.");
          }
        }

        handleOpenChange(false);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Failed to create workspace";
        setError(errMsg);
        toast.error(errMsg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [workspaceContext, isFormValid, isAuthenticated, formData, handleOpenChange, onWorkspaceCreated]
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || <Button variant={triggerVariant}>{triggerText}</Button>}
      </DialogTrigger>

      <DialogContent className="projects-modal-container border-none">
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--primary)]">
              <HiBuildingOffice2 className="projects-modal-icon-content" />
            </div>
            <div className="projects-modal-info">
              <DialogTitle className="projects-modal-title">Create new workspace</DialogTitle>
              <DialogDescription className="projects-modal-description">
                Provide basic information about your new workspace
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="projects-modal-form">
          {error && (
            <Alert variant="destructive" className="border-none">
              <HiExclamationTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="projects-form-field">
            <Label htmlFor="workspace-name" className="projects-form-label">
              <HiSparkles
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Workspace name <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="workspace-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter workspace name"
              disabled={isSubmitting}
              className="projects-form-input border-none"
              onFocus={(e) => {
                e.target.style.boxShadow = "none";
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = "none";
              }}
              autoFocus
            />
            <p className="projects-form-hint">
              <HiSparkles
                className="projects-form-hint-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Choose a clear, descriptive name for your workspace.
            </p>
          </div>

          <div className="projects-form-field">
            <Label htmlFor="workspace-description" className="projects-form-label">
              <HiDocumentText
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Description <span className="projects-form-label-required">*</span>
            </Label>
            <Textarea
              id="workspace-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Describe the purpose of this workspace..."
              disabled={isSubmitting}
              className="projects-form-textarea border-none"
              style={{}}
              onFocus={(e) => {
                e.target.style.boxShadow = "none";
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = "none";
              }}
            />
            <p className="projects-form-hint">
              <HiDocumentText
                className="projects-form-hint-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Help team members understand what this workspace is for.
            </p>
          </div>

          <div className="projects-form-actions flex gap-2 justify-end mt-6">
            <ActionButton
              type="button"
              secondary
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </ActionButton>
            <ActionButton type="submit" primary disabled={isSubmitting || !isFormValid()}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating workspace...
                </>
              ) : (
                "Create workspace"
              )}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
