import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

interface DynamicBadgeProps {
  text?: string;
  label?: string;
  category?: string;
  bgColor?: string;
  textColor?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "solid" | "outline" | "subtle";
}

const badgeVariants = cva(
  "rounded-full font-medium border shadow-none transition-none flex items-center",
  {
    variants: {
      size: {
        sm: "text-xs px-2.5 py-0.5 h-5",
        md: "text-xs px-3 py-1 h-6",
        lg: "text-sm px-3.5 py-1.5 h-7",
      },
      variant: {
        solid: "",
        outline: "bg-transparent border-current",
        subtle: "bg-opacity-15",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "solid",
    },
  }
);

export const DynamicBadge: React.FC<DynamicBadgeProps> = ({
  text,
  label,
  bgColor = "#6366f1",
  textColor = "#ffffff",
  size = "md",
  variant = "solid",
  className = "",
}) => {
  // Calculate contrast color if not provided
  const effectiveTextColor = variant === "outline" ? bgColor : textColor;

  return (
    <Badge
      className={cn(badgeVariants({ size, variant }), className)}
      style={{
        backgroundColor:
          variant === "solid" ? bgColor : variant === "subtle" ? `${bgColor}26` : "transparent",
        color: effectiveTextColor,
        borderColor: variant === "outline" ? bgColor : "transparent",
      }}
    >
      {label ?? text}
    </Badge>
  );
};
