import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { useState } from "react";

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onDelete,
  onClear,
}) => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  if (selectedCount === 0) return null;

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowDeleteConfirmation(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg px-3 py-2 flex items-center gap-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {selectedCount}
              </span>
            </div>
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedCount} {selectedCount === 1 ? "task" : "tasks"} selected
            </span>
          </div>

          <div className="h-5 w-px bg-[var(--border)] flex-shrink-0" />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              <span className="text-sm">Delete</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Tasks"
        message={`Are you sure you want to delete ${selectedCount} ${
          selectedCount === 1 ? "task" : "tasks"
        }? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </>
  );
};