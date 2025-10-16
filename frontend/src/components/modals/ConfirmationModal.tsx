import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HiExclamationTriangle, HiInformationCircle } from "react-icons/hi2";
import ActionButton from "../common/ActionButton";

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

        <DialogFooter className="flex justify-end gap-2">
          <ActionButton type="submit" primary onClick={onConfirm}>
            {confirmText}
          </ActionButton>
          <ActionButton variant="outline" onClick={onClose}>
            {cancelText}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
