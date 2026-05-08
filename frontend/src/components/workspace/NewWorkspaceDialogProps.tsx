import { useState, useCallback } from "react";
import { isValidSlug } from "@/utils/slugUtils";
import { useRouter } from "next/router";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "react-i18next";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import ActionButton from "../common/ActionButton";

interface FormData {
  name: string;
  description: string;
  parentWorkspaceId: string;
  inheritMembers: boolean;
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
  triggerText,
  triggerVariant = "default",
  onWorkspaceCreated,
}: NewWorkspaceDialogProps) {
  const { t } = useTranslation("workspaces");
  const router = useRouter();
  const workspaceContext = useWorkspaceContext();
  const { isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    parentWorkspaceId: "",
    inheritMembers: true,
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
    setFormData({ name: "", description: "", parentWorkspaceId: "", inheritMembers: true });
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
        setError(t("modal.errorNoOrg"));
        return;
      }

      if (!isFormValid()) {
        setError(t("modal.errorFields"));
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        if (!isAuthenticated()) {
          throw new Error(t("modal.errorAuth"));
        }

        const newWorkspace = await workspaceContext.createWorkspace({
          name: formData.name.trim(),
          description: formData.description.trim(),
          inheritMembers: formData.inheritMembers,
          inheritLabels: formData.inheritMembers,
          inheritWorkflows: formData.inheritMembers,
          ...(formData.parentWorkspaceId ? { parentWorkspaceId: formData.parentWorkspaceId } : {}),
        });

        if (onWorkspaceCreated) {
          try {
            await onWorkspaceCreated();
          } catch (refreshError) {
            console.error("Failed to refresh workspaces:", refreshError);
          }
        }

        handleOpenChange(false);
        toast.success(t("modal.success", { name: formData.name }));

        if (isValidSlug(newWorkspace?.slug)) {
          router.push(`/${newWorkspace.slug}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : t("modal.errorCreate");
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
        {children || <Button variant={triggerVariant}>{triggerText || t("modal.createTitle")}</Button>}
      </DialogTrigger>

      <DialogContent className="projects-modal-container border-none">
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--primary)]">
              <HiBuildingOffice2 className="projects-modal-icon-content" />
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
              {t("modal.workspaceName")} <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="workspace-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder={t("modal.enterWorkspaceName")}
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
              {t("modal.workspaceNameHint")}
            </p>
          </div>

          <div className="projects-form-field">
            <Label htmlFor="workspace-description" className="projects-form-label">
              <HiDocumentText
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              {t("modal.description")} <span className="projects-form-label-required">*</span>
            </Label>
            <Textarea
              id="workspace-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              placeholder={t("modal.descriptionPlaceholder")}
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
              {t("modal.descriptionHint")}
            </p>
          </div>

          <div className="projects-form-field">
            <Label htmlFor="parent-workspace" className="projects-form-label">
              <HiBuildingOffice2
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              {t("modal.parentWorkspace")} <span className="text-muted-foreground font-normal">{t("modal.optional")}</span>
            </Label>
            <Select
              value={formData.parentWorkspaceId || "none"}
              onValueChange={(value) => {
                const newParentId = value === "none" ? "" : value;
                setFormData((prev) => ({
                  ...prev,
                  parentWorkspaceId: newParentId,
                  inheritMembers: !!newParentId,
                }));
                if (error) setError(null);
              }}
            >
              <SelectTrigger className="projects-form-input border-none">
                <SelectValue placeholder={t("modal.none")} />
              </SelectTrigger>
              <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                <SelectItem value="none">{t("modal.none")}</SelectItem>
                {workspaceContext?.workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="projects-form-hint mt-2">
              {t("modal.parentWorkspaceHint")}
            </p>
          </div>

          {formData.parentWorkspaceId && (
            <div className="projects-form-field flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-[var(--card)] border-[var(--border)]">
              <Checkbox
                id="inherit-members"
                checked={formData.inheritMembers}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, inheritMembers: checked === true }))
                }
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="inherit-members" className="font-medium cursor-pointer">
                  {t("modal.inheritFromParent")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("modal.inheritHint")}
                </p>
              </div>
            </div>
          )}

          <div className="projects-form-actions flex gap-2 justify-end mt-6">
            <ActionButton
              type="button"
              secondary
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("modal.cancel")}
            </ActionButton>
            <ActionButton type="submit" primary disabled={isSubmitting || !isFormValid()}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  {t("modal.creating")}
                </>
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
