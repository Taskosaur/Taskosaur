import { ReactNode } from "react";

interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ icon, title, description, actions, className = "" }: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}
    >
      <div className="flex-1">
        <h1 className="text-md font-bold flex items-center gap-2">
          {icon}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>
        )}
      </div>

      {actions && <div className="flex items-center gap-4">{actions}</div>}
    </header>
  );
}
