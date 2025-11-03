import { useState } from "react";
import { useRouter } from "next/navigation";
import { Organization, CreateOrganizationDto } from "@/types";
import { Button } from "@/components/ui";
import { organizationApi } from "@/utils/api";

interface OrganizationFormProps {
  organization?: Organization;
  onSuccess?: (organization: Organization) => void;
  onCancel?: () => void;
}

export default function OrganizationForm({
  organization,
  onSuccess,
  onCancel,
}: OrganizationFormProps) {
  const router = useRouter();
  const isEditing = !!organization;

  const [formData, setFormData] = useState<CreateOrganizationDto>({
    name: organization?.name || "",
    slug: organization?.slug || "",
    description: organization?.description || "",
    website: organization?.website || "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required";
    }

    if (!formData.slug.trim()) {
      newErrors.slug = "Organization slug is required";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = "Slug can only contain lowercase letters, numbers, and hyphens";
    }

    if (formData.website && !isValidUrl(formData.website)) {
      newErrors.website = "Please enter a valid URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      let result: Organization;

      if (isEditing) {
        result = await organizationApi.updateOrganization(organization.id, formData);
      } else {
        result = await organizationApi.createOrganization(formData);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/organizations/${result.slug}`);
      }
    } catch (error) {
      console.error("Error saving organization:", error);
      setErrors({ submit: "Failed to save organization. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="organizations-form">
      <div className="organizations-form-field">
        <label htmlFor="name" className="form-label-primary">
          Organization Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleNameChange}
          className="form-input-primary"
          placeholder="Enter organization name"
          required
        />
        {errors.name && <p className="form-error-text">{errors.name}</p>}
      </div>

      <div className="organizations-form-field">
        <label htmlFor="slug" className="form-label-primary">
          Organization Slug *
        </label>
        <input
          type="text"
          id="slug"
          name="slug"
          value={formData.slug}
          onChange={handleChange}
          className="form-input-primary"
          placeholder="organization-slug"
          required
        />
        <p className="organizations-form-slug-hint">
          This will be used in your organization URL. Only lowercase letters, numbers, and hyphens
          are allowed.
        </p>
        {errors.slug && <p className="form-error-text">{errors.slug}</p>}
      </div>

      <div className="organizations-form-field">
        <label htmlFor="description" className="form-label-primary">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          className="form-textarea-primary"
          placeholder="Describe your organization..."
        />
      </div>

      <div className="organizations-form-field">
        <label htmlFor="website" className="form-label-primary">
          Website
        </label>
        <input
          type="url"
          id="website"
          name="website"
          value={formData.website}
          onChange={handleChange}
          className="form-input-primary"
          placeholder="https://your-website.com"
        />
        {errors.website && <p className="form-error-text">{errors.website}</p>}
      </div>

      {errors.submit && (
        <div className="form-error-box">
          <p className="form-error-box-text">{errors.submit}</p>
        </div>
      )}

      <div className="organizations-form-actions">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isEditing ? "Update Organization" : "Create Organization"}
        </Button>
      </div>
    </form>
  );
}
