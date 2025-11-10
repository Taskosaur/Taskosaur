import Link from "next/link";
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface EntityCardProps {
  href?: string;
  onClick?: () => void;
  leading: ReactNode;
  heading: ReactNode;
  subheading?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  role?: string;
}

export function EntityCard({
  href,
  onClick,
  leading,
  heading,
  subheading,
  description,
  role,
  footer,
  className = "",
}: EntityCardProps) {
  const Inner = () => (
    <Card
      onClick={onClick}
      className={`bg-[var(--card)] rounded-md shadow-sm group hover:shadow-lg transition-all duration-200 border-none ${onClick || href ? "cursor-pointer" : ""} p-4 h-44 ${className}`}
    >
      {/* Top Row */}
      <div className="flex items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors line-clamp-2">
            {heading}
          </div>
          {subheading && (
            <div className="text-xs text-[var(--muted-foreground)] line-clamp-1">{subheading}</div>
          )}
        </div>
        {role && (
          <div className="inline-flex items-center px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-medium">
            {role
              ?.replace("_", " ")
              .toLowerCase()
              .replace(/\b\w/g, (l) => l.toUpperCase())}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="text-sm text-[var(--muted-foreground)] line-clamp-2 h-[50px]">
        {description || "No description provided"}
      </div>

      {/* Footer */}
      {footer && (
        <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
          {footer}
        </div>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} style={{ textDecoration: "none" }}>
      <Inner />
    </Link>
  ) : (
    <Inner />
  );
}
