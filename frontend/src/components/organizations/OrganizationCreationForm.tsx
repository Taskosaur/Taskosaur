import { useOrganization } from "@/contexts/organization-context";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("organizations");
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
      setError(err instanceof Error ? err.message : t("modal.errorDefault"));
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
              <span className="text-sm font-medium">{t("modal.errorTitle")}</span>
            </div>
            <p className="text-sm text-[var(--destructive)] mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">{t("modal.name")} *</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("modal.namePlaceholder")}
            required
            disabled={submitting}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="description">{t("modal.description")}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("modal.descriptionPlaceholder")}
            rows={3}
            disabled={submitting}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="website">{t("modal.website")}</Label>
          <Input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={t("modal.websitePlaceholder")}
            disabled={submitting}
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t("modal.cancel")}
        </Button>
        <Button type="submit" disabled={submitting || !name.trim()} className="min-w-[140px]">
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--primary-foreground)] border-t-transparent mr-2" />
              {t("modal.creating")}
            </>
          ) : (
            <>
              <HiPlus size={16} className="mr-2" />
              {t("modal.create")}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default OrganizationCreationForm;
