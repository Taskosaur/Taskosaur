import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  size = "md",
}: ToggleSwitchProps) {
  const sizeClasses = {
    sm: {
      track: "w-8 h-4",
      thumb: "w-3 h-3",
      translate: "translate-x-4",
    },
    md: {
      track: "w-11 h-6",
      thumb: "w-5 h-5",
      translate: "translate-x-5",
    },
    lg: {
      track: "w-14 h-7",
      thumb: "w-6 h-6",
      translate: "translate-x-7",
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex ${currentSize.track} items-center rounded-full 
        transition-colors duration-300 ease-in-out focus:outline-none 
       
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${checked ? "bg-[var(--foreground)]" : "bg-gray-300 hover:bg-gray-400"}
      `}
    >
      <span
        className={`
          ${currentSize.thumb} inline-block transform rounded-full 
          bg-[var(--background)] shadow-lg transition-transform duration-300 ease-in-out
          ${checked ? currentSize.translate : "translate-x-0.5"}
        `}
      />
    </button>
  );
}
