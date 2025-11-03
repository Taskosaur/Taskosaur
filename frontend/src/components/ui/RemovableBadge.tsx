import { ReactNode } from "react";
import { HiXMark } from "react-icons/hi2";
import { cn } from "@/lib/utils";

interface RemovableBadgeProps {
  children: ReactNode;
  onRemove?: () => void;
  variant?: "default" | "primary" | "success" | "warning" | "info" | "secondary" | "error";
  className?: string;
}

const badgeVariants = {
  default: "bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300",
  primary: "bg-primary-100 text-primary-600 dark:bg-primary-800 dark:text-primary-300",
  success: "bg-success-light text-success-dark dark:bg-success-dark/30 dark:text-success",
  warning: "bg-warning-light text-warning-dark dark:bg-warning-dark/30 dark:text-warning",
  info: "bg-info-light text-info-dark dark:bg-info-dark/30 dark:text-info",
  secondary: "bg-secondary-200 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-300",
  error: "bg-error-light text-error-dark dark:bg-error-dark/30 dark:text-error",
};

export function RemovableBadge({
  children,
  onRemove,
  variant = "default",
  className,
}: RemovableBadgeProps) {
  return (
    <span className={cn("removable-badge-base", badgeVariants[variant], className)}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="removable-badge-close">
          <HiXMark size={12} />
        </button>
      )}
    </span>
  );
}
