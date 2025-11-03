import { ReactNode } from "react";
import { HiX } from "react-icons/hi";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop">
        <div className="modal-backdrop-blur" onClick={onClose} />
        <span className="modal-spacer">&#8203;</span>
        <div className={cn("modal-container", className)}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{title}</h3>
              <button onClick={onClose} className="modal-close-button">
                <HiX size={20} />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
