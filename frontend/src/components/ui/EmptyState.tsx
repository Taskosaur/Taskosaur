import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("empty-state-container", className)}>
      <div className="w-16 h-16 bg-[var(--muted)] rounded-xl flex-center-gap mx-auto mb-6 text-[var(--muted-foreground)]">
        {icon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action}
    </div>
  );
}
