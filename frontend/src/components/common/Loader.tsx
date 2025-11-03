import React from "react";
import { cn } from "@/lib/utils";

interface LoaderProps {
  /** Optional text to display below the spinner */
  text?: string;
  /** Controls the size of the spinner */
  size?: "sm" | "md" | "lg";
  /** Custom classes for the container */
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ text, size = "md", className }) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-4 border-solid border-[var(--primary)] border-t-transparent",
          sizeClasses[size]
        )}
        role="status"
        aria-label="Loading"
      ></div>
      {text && <p className="text-sm text-[var(--muted-foreground)]">{text}</p>}
    </div>
  );
};

export default Loader;
