import { useOrganization } from "@/contexts/organization-context";
import { useState } from "react";
import { Button, Card, CardContent, Input, Label, Textarea } from "../ui";
import { HiExclamationTriangle } from "react-icons/hi2";
import { HiPlus } from "react-icons/hi";
import { Organization } from "@/types";

const OrganizationCreationForm = ({
  onSuccess,
  onCancel,
  isSubmitting: externalSubmitting = false,
}: {
  onSuccess: (org: Organization) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
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
    } catch (err) {
      console.error("Error creating organization:", err);
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitting = isSubmitting || externalSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Card className="border-[var(--destructive)]/30 bg-[var(--destructive)]/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[var(--destructive)]">
              <HiExclamationTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">Error creating organization</span>
            </div>
            <p className="text-sm text-[var(--destructive)] mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Organization Name *</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter organization name"
            required
            disabled={submitting}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your organization..."
            rows={3}
            disabled={submitting}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            disabled={submitting}
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !name.trim()} className="min-w-[140px]">
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--primary-foreground)] border-t-transparent mr-2" />
              Creating...
            </>
          ) : (
            <>
              <HiPlus size={16} className="mr-2" />
              Create Organization
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default OrganizationCreationForm;
