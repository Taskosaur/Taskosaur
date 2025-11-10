import Link from "next/link";
import { ReactNode } from "react";
import { HiChevronRight } from "react-icons/hi2";

interface InfoPanelProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllText?: string;
  children: ReactNode;
  className?: string;
}

export function InfoPanel({
  title,
  subtitle,
  viewAllHref,
  viewAllText = "View all",
  children,
  className = "",
}: InfoPanelProps) {
  return (
    <div className={`bg-[var(--card)] rounded-md shadow-sm ${className}`}>
      {/* Card Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-[var(--primary)] rounded-full" />
            <h3 className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wide">
              {title}
            </h3>
          </div>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary)]/90 flex items-center gap-1"
            >
              {viewAllText} <HiChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        {subtitle && (
          <p className="dashboard-card-subtitle text-xs text-[var(--muted-foreground)]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Card Content */}
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}
