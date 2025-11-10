import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import ActionButton from "@/components/common/ActionButton";
import { DynamicBadge } from "@/components/common/DynamicBadge";
import { HiTag, HiPencil } from "react-icons/hi2";
import { toast } from "sonner";
import { labelColors } from "@/utils/data/taskData";
interface TaskLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
  labelId?: string;
}

interface TaskLabelsProps {
  labels: TaskLabel[];
  availableLabels: TaskLabel[];
  onAddLabel: (name: string, color: string) => Promise<void>;
  onAssignExistingLabel: (label: TaskLabel) => Promise<void>;
  onRemoveLabel: (labelId: string) => Promise<void>;
  hasAccess?: boolean;
  setLoading?: (loading: boolean) => void;
}

// const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
//   <div className="flex items-center gap-2 mb-4">
//     <Icon size={16} className="text-[var(--primary)]" />
//     <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
//   </div>
// );

export default function TaskLabels({
  labels,
  availableLabels,
  onAddLabel,
  onAssignExistingLabel,
  onRemoveLabel,
  hasAccess = false,
  setLoading,
}: TaskLabelsProps) {
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3B82F6");
  const [loadingLabels, setLoadingLabels] = useState(false);

  const handleAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAccess) return toast.error("You don't have access to update the task label");

    if (!newLabelName.trim()) return;

    try {
      setLoadingLabels(true);
      await onAddLabel(newLabelName.trim(), newLabelColor);
      resetForm();
    } catch (error) {
      console.error("Failed to add label:", error);
    } finally {
      setLoadingLabels(false);
    }
  };

  const resetForm = () => {
    setIsAddingLabel(false);
    setNewLabelName("");
    setNewLabelColor("#3B82F6");
  };

  const handleRemoveLabel = async (labelId: string) => {
    if (!hasAccess) return toast.error("You don't have access to update the task label");

    try {
      setLoadingLabels(true);
      await onRemoveLabel(labelId);
    } catch (error) {
      console.error("Failed to remove label:", error);
    } finally {
      setLoadingLabels(false);
    }
  };

  const handleAssignLabel = async (label: TaskLabel) => {
    if (!hasAccess) return toast.error("You don't have access to update the task label");

    try {
      setLoadingLabels(true);
      await onAssignExistingLabel(label);
    } catch (error) {
      console.error("Failed to assign label:", error);
    } finally {
      setLoadingLabels(false);
    }
  };

  useEffect(() => {
    if (setLoading) {
      setLoading(loadingLabels);
    }
  }, [loadingLabels]);

  // Filter out already assigned labels from available labels
  const unassignedLabels = availableLabels.filter(
    (availableLabel) =>
      !labels.some(
        (assignedLabel) =>
          (assignedLabel.id && assignedLabel.id === availableLabel.id) ||
          (assignedLabel.labelId && assignedLabel.labelId === availableLabel.id)
      )
  );

  return (
    <div className="space-y-4">
      {/* Current labels */}
      {labels.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-medium text-[var(--foreground)]">Current labels:</div>
            {hasAccess && (
              <button
                type="button"
                className="rounded transition flex items-center cursor-pointer"
                onClick={() => setIsEditing((prev) => !prev)}
                tabIndex={0}
                aria-label="Edit"
                style={{ lineHeight: 0 }}
              >
                <HiPencil className="w-3 h-3 text-[var(--muted-foreground)]" />
                <span className="sr-only">Edit</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {labels.map((label) => (
              <div key={label.labelId || label.id}>
                <ActionButton
                  variant="ghost"
                  onClick={() => handleRemoveLabel(label.labelId || label.id)}
                  className="p-0 h-auto transition-transform"
                >
                  <DynamicBadge
                    label={label.name}
                    bgColor={label.color}
                    size="md"
                    className="cursor-pointer"
                  />
                </ActionButton>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center rounded-lg border-none">
          <div className="flex items-center justify-between">
            {/* Left side: icon + text */}
            <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-sm">
              <HiTag className="size-3 text-[var(--muted-foreground)]" />
              <span>No current labels</span>
            </div>

            {/* Right side: edit icon (only if access) */}
            {hasAccess && (
              <button
                type="button"
                className="rounded transition flex items-center cursor-pointer p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs"
                onClick={() => setIsEditing((prev) => !prev)}
                tabIndex={0}
                aria-label="Edit"
                style={{ lineHeight: 0 }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit mode: show available labels and add new label */}
      {isEditing && hasAccess && (
        <>
          {/* Available labels */}
          {unassignedLabels.length > 0 && (
            <div className="">
              <div className="text-sm font-medium text-[var(--foreground)]">Available labels:</div>
              <div className="flex flex-wrap gap-2">
                {unassignedLabels.map((label) => (
                  <ActionButton
                    key={label.id}
                    variant="ghost"
                    onClick={() => handleAssignLabel(label)}
                    className="p-0 h-auto transition-transform"
                  >
                    <DynamicBadge
                      label={label.name}
                      bgColor={label.color}
                      size="md"
                      className="cursor-pointer"
                    />
                  </ActionButton>
                ))}
              </div>
            </div>
          )}

          {/* Add new label form */}
          {isAddingLabel ? (
            <div className="space-y-4 p-4 bg-[var(--muted)]/30 rounded-lg border border-[var(--border)] mt-2">
              <form onSubmit={handleAddLabel} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="label-name"
                    className="text-sm font-medium text-[var(--foreground)]"
                  >
                    Label name
                  </Label>
                  <Input
                    id="label-name"
                    type="text"
                    value={newLabelName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewLabelName(e.target.value)
                    }
                    placeholder="Enter label name"
                    autoFocus
                    maxLength={50}
                    className="h-9 border-input bg-background text-[var(--foreground)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[var(--foreground)]">Color</Label>
                  <div className="grid grid-cols-6 gap-2">
                    {labelColors.map((color) => (
                      <Button
                        key={color.value}
                        type="button"
                        variant="ghost"
                        onClick={() => setNewLabelColor(color.value)}
                        className={`w-10 h-10 p-0 rounded-full border-2 transition-all duration-200 ${
                          newLabelColor === color.value
                            ? "border-[var(--primary)]  "
                            : "border-[var(--border)] "
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs text-[var(--muted-foreground)]">Preview:</span>
                    <DynamicBadge
                      label={newLabelName || "Label preview"}
                      bgColor={newLabelColor}
                      size="md"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <ActionButton
                    type="submit"
                    disabled={!newLabelName.trim()}
                    primary
                    className="flex-1 cursor-pointer"
                  >
                    Add Label
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    secondary
                    className="cursor-pointer"
                  >
                    Cancel
                  </ActionButton>
                </div>
              </form>
            </div>
          ) : (
            <ActionButton
              variant="outline"
              onClick={() => setIsAddingLabel(true)}
              showPlusIcon
              secondary
              className="w-full justify-center cursor-pointer mt-2"
            >
              Add new label
            </ActionButton>
          )}
        </>
      )}
    </div>
  );
}
