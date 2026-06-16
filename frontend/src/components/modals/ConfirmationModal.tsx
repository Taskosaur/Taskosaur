import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HiExclamationTriangle, HiInformationCircle } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import ActionButton from "@/components/common/ActionButton";
import { cn } from "@/lib/utils";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "info",
}: ConfirmationModalProps) {
  const getIcon = () => {
    switch (type) {
      case "danger":
        return <HiExclamationTriangle className="h-6 w-6 text-red-500" />;
      case "warning":
        return <HiExclamationTriangle className="h-6 w-6 text-yellow-500" />;
      default:
        return <HiInformationCircle className="h-6 w-6 text-blue-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-[var(--border)]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getIcon()}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-end gap-3 mt-4">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="px-6 h-10 rounded-lg font-medium border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]"
          >
            {cancelText || "Cancel"}
          </Button>
          <ActionButton
            variant={type === "danger" ? "destructive" : "default"}
            onClick={onConfirm}
            className={cn(
              "px-6 h-10 rounded-lg font-medium shadow-sm transition-all hover:shadow-md active:scale-95",
              type !== "danger" && "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90"
            )}
          >
            {confirmText}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
