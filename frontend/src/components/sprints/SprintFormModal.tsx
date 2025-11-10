import { Sprint } from "@/types";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { HiRocketLaunch, HiSparkles, HiDocumentText, HiCalendar, HiFlag } from "react-icons/hi2";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import ActionButton from "../common/ActionButton";
import { getTodayDate } from "@/utils/handleDateChange";

export const SprintFormModal = ({
  isOpen,
  onClose,
  sprint,
  projectSlug,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  sprint: Sprint | null;
  projectSlug: string;
  onSave: (data: any) => Promise<void>;
}) => {
  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
    status: "PLANNING" as Sprint["status"],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isDateAfter = (date1: string, date2: string) => {
    return new Date(date1) > new Date(date2);
  };

  useEffect(() => {
    if (sprint) {
      setFormData({
        name: sprint.name || "",
        goal: sprint.goal || "",
        startDate: sprint.startDate ? sprint.startDate.split("T")[0] : "",
        endDate: sprint.endDate ? sprint.endDate.split("T")[0] : "",
        status: sprint.status || "PLANNING",
      });
    } else {
      setFormData({
        name: "",
        goal: "",
        startDate: "",
        endDate: "",
        status: "PLANNING",
      });
    }
    setErrors({});
  }, [sprint, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Sprint name is required";
    }
    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    }
    if (!formData.endDate) {
      newErrors.endDate = "End date is required";
    }
    if (formData.startDate && formData.endDate) {
      if (isDateAfter(formData.startDate, formData.endDate)) {
        newErrors.endDate = "End date must be after start date";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        goal: formData.goal.trim(),
        status: formData.status,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        projectId: projectSlug,
      };

      await onSave(submitData);
      onClose();
    } catch (error) {
      console.error("Error saving sprint:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      goal: "",
      startDate: "",
      endDate: "",
      status: "PLANNING",
    });
    setErrors({});
    onClose();
  };

  const isValid = formData.name.trim().length > 0 && formData.startDate && formData.endDate;

  return (
    <div automation-id="create-sprint-modal">
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="projects-modal-container border-none">
          <DialogHeader className="projects-modal-header">
            <div className="projects-modal-header-content">
              <div className="projects-modal-icon bg-[var(--primary)]">
                <HiRocketLaunch className="projects-modal-icon-content" />
              </div>
              <div className="projects-modal-info">
                <DialogTitle className="projects-modal-title">
                  {sprint ? "Edit Sprint" : "Create new sprint"}
                </DialogTitle>
                <DialogDescription className="projects-modal-description">
                  {sprint
                    ? "Update sprint details and timeline"
                    : "Create a new sprint to organize your work into focused iterations"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="projects-modal-form">
            {/* Sprint Name */}
            <div className="projects-form-field">
              <Label htmlFor="name" className="projects-form-label">
                <HiSparkles
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Sprint name <span className="projects-form-label-required">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter sprint name"
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
                disabled={saving}
              />
              {errors.name && (
                <p className="text-sm text-[var(--destructive)] mt-1">{errors.name}</p>
              )}
            </div>

            {/* Sprint Goal */}
            <div className="projects-form-field">
              <Label htmlFor="goal" className="projects-form-label">
                <HiDocumentText
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Sprint goal
              </Label>
              <Textarea
                id="goal"
                placeholder="Describe the main objective and outcomes for this sprint..."
                value={formData.goal}
                onChange={(e) => setFormData((prev) => ({ ...prev, goal: e.target.value }))}
                className="projects-form-textarea border-none"
                rows={3}
                onFocus={(e) => {
                  e.target.style.boxShadow = "none";
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = "none";
                }}
                disabled={saving}
              />
              <p className="projects-form-hint">
                <HiSparkles
                  className="projects-form-hint-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Help your team understand the sprint's focus and expected outcomes.
              </p>
            </div>

            {/* Sprint Status */}
            <div className="projects-form-field">
              <Label className="projects-form-label">
                <HiFlag
                  className="projects-form-label-icon"
                  style={{ color: "hsl(var(--primary))" }}
                />
                Status <span className="projects-form-label-required">*</span>
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: value as Sprint["status"],
                  }))
                }
                disabled={saving}
              >
                <SelectTrigger
                  className="projects-workspace-button border-none"
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--card)]">
                  <SelectItem value="PLANNING" className="hover:bg-[var(--hover-bg)]">
                    Planning
                  </SelectItem>
                  <SelectItem value="ACTIVE" className="hover:bg-[var(--hover-bg)]">
                    Active
                  </SelectItem>
                  <SelectItem value="COMPLETED" className="hover:bg-[var(--hover-bg)]">
                    Completed
                  </SelectItem>
                  <SelectItem value="CANCELLED" className="hover:bg-[var(--hover-bg)]">
                    Cancelled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="projects-form-field">
                <Label htmlFor="startDate" className="projects-form-label">
                  <HiCalendar
                    className="projects-form-label-icon"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  Start date <span className="projects-form-label-required">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  max={formData?.endDate || undefined}
                  min={getTodayDate()}
                  className="projects-form-input border-none"
                  onFocus={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                  disabled={saving}
                />
                {errors.startDate && (
                  <p className="text-sm text-[var(--destructive)] mt-1">{errors.startDate}</p>
                )}
              </div>

              <div className="projects-form-field">
                <Label htmlFor="endDate" className="projects-form-label">
                  <HiCalendar
                    className="projects-form-label-icon"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  End date <span className="projects-form-label-required">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="projects-form-input border-none"
                  onFocus={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                  disabled={saving}
                  min={formData?.startDate || getTodayDate()}
                />
                {errors.endDate && (
                  <p className="text-sm text-[var(--destructive)] mt-1">{errors.endDate}</p>
                )}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="projects-form-actions flex gap-2 justify-end mt-6">
              <ActionButton type="button" secondary onClick={handleClose} disabled={saving}>
                Cancel
              </ActionButton>
              <ActionButton type="submit" primary disabled={!isValid || saving}>
                {saving ? (
                  <>
                    <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    {sprint ? "Updating..." : "Creating sprint..."}
                  </>
                ) : sprint ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </ActionButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
