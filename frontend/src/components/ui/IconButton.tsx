import { cn } from "@/lib/utils";
import React from "react";

interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  title?: string;
}

const iconButtonVariants = {
  primary: "iconbutton-primary",
  secondary: "iconbutton-secondary",
  outline: "iconbutton-outline",
  ghost: "iconbutton-ghost",
};

const iconButtonSizes = {
  xs: "iconbutton-xs",
  sm: "iconbutton-sm",
  md: "iconbutton-md",
  lg: "iconbutton-lg",
};

export function IconButton({
  icon,
  onClick,
  variant = "ghost",
  size = "sm",
  disabled = false,
  className,
  title,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "iconbutton-base",
        iconButtonVariants[variant],
        iconButtonSizes[size],
        className
      )}
    >
      {icon}
    </button>
  );
}
