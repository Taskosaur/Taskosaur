import { useOrganization } from "@/contexts/organization-context";
import { Organization } from "@/types";
import { useState } from "react";
import { HiBuildingOffice2, HiExclamationTriangle } from "react-icons/hi2";
import { Button, Input, Label, Textarea } from "../ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";

const OrganizationFormModal = ({
  showCreateForm,
  setShowCreateForm,
  onSuccess,
  onCancel,
  onOpenChange,
}: {
  children?: React.ReactNode;
  showCreateForm?: boolean;
  setShowCreateForm?: any;
  onSuccess: (org: Organization) => void;
  onCancel: () => void;
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onOpenChange?: (open: boolean) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createOrganization } = useOrganization();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const organizationData = {
        name,
        description: description || undefined,
        website: website || undefined,
      };

      const newOrg = await createOrganization(organizationData);
      onSuccess(newOrg);
      toast.success("Organization created successfully!");
    } catch (err) {
      setError(err?.message ? err?.message[0] : "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowCreateForm(false);
  };

  return (
    <Dialog open={showCreateForm} onOpenChange={handleClose}>
      <DialogContent className="projects-modal-container border-none">
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--primary)]">
              <HiBuildingOffice2 className="projects-modal-icon-content" />
            </div>
            <div className="projects-modal-info">
              <DialogTitle className="projects-modal-title">Create New Organization</DialogTitle>
              <DialogDescription className="projects-modal-description">
                Provide information about your new organization
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg">
              <div className="flex items-center gap-3">
                <HiExclamationTriangle className="w-5 h-5 text-[var(--destructive)] flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-[var(--destructive)] mb-1">
                    Error creating organization
                  </h4>
                  <p className="text-sm text-[var(--destructive)]/80">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="org-name" className="text-sm font-medium text-[var(--foreground)]">
                Organization Name<span className="text-red-400">*</span>
              </Label>
              <Input
                id="org-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter organization name"
                required
                disabled={isSubmitting}
                className="mt-1 border-input bg-background text-[var(--foreground)]"
              />
            </div>

            <div>
              <Label
                htmlFor="org-description"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                Description
              </Label>
              <Textarea
                id="org-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your organization..."
                rows={3}
                disabled={isSubmitting}
                className="mt-1 border-input bg-background text-[var(--foreground)]"
              />
            </div>

            <div>
              <Label htmlFor="org-website" className="text-sm font-medium text-[var(--foreground)]">
                Website
              </Label>
              <Input
                id="org-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                disabled={isSubmitting}
                className="mt-1 border-input bg-background text-[var(--foreground)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-9 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-all duration-200 font-medium"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating...
                </>
              ) : (
                <>Create Organization</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationFormModal;
