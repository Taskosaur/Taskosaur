import React from "react";
import { cn } from "@/lib/utils"; // optional helper if you use clsx/tailwind merge

interface DividerProps {
  label?: string;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

const Divider: React.FC<DividerProps> = ({ label, className, orientation = "horizontal" }) => {
  if (orientation === "vertical") {
    return <div className={cn("w-px h-full bg-[var(--border)] mx-4", className)} />;
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <div className="flex-grow border-t border-[var(--border)]" />
      {label && (
        <span className="mx-3 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide bg-[var(--background)] px-2">
          {label}
        </span>
      )}
      <div className="flex-grow border-t border-[var(--border)]" />
    </div>
  );
};

export default Divider;
