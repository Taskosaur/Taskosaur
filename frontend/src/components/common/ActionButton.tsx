import React from "react";
import { Button } from "@/components/ui/button";
import { HiPlus } from "react-icons/hi2";

export interface ActionButtonProps {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "link" | "destructive";
  onClick?: (any) => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  asChild?: boolean;
  showPlusIcon?: boolean;
  secondary?: boolean;
  primary?: boolean;
  onMouseEnter?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      leftIcon,
      rightIcon,
      children,
      className = "",
      variant = "default",
      onClick,
      type = "button",
      disabled = false,
      asChild = false,
      showPlusIcon = false,
      secondary = false,
      primary = false,
      ...props
    },
    ref
  ) => {
    // Define semantic classes based on props
    const getSemanticClasses = () => {
      let classes = "actionbutton-base";

      if (secondary) {
        classes += " actionbutton-secondary";
      } else if (primary) {
        classes += " actionbutton-primary";
      } else {
        switch (variant) {
          case "outline":
            classes += " actionbutton-outline";
            break;
          case "ghost":
            classes += " actionbutton-ghost";
            break;
          default:
            classes += " actionbutton-default";
        }
      }

      return classes;
    };

    // Combine all classes
    const combinedClasses = `${getSemanticClasses()} ${className}`;

    if (asChild) {
      return (
        <Button
          ref={ref}
          variant={variant}
          className={combinedClasses}
          onClick={onClick}
          type={type}
          disabled={disabled}
          asChild
          {...props}
        >
          {children}
        </Button>
      );
    }

    return (
      <Button
        ref={ref}
        variant={variant}
        className={combinedClasses}
        onClick={onClick}
        type={type}
        disabled={disabled}
        {...props}
      >
        {showPlusIcon && (
          <span className="flex-shrink-0">
            <HiPlus className="w-4 h-4" />
          </span>
        )}
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span className="truncate">{children}</span>
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </Button>
    );
  }
);

ActionButton.displayName = "ActionButton";

export default ActionButton;
