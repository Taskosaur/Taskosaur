import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActionValueSelectorProps {
  actionType: "setPriority" | "assignTo" | "addLabels" | "markAsSpam" | "autoReply";
  value: string | string[];
  onChange: (value: string | string[]) => void;

  options?: Array<{
    id: string;
    value: string;
    label: string;
    color?: string;
    avatar?: string | null;
    email?: string;
  }>;
  isLoading?: boolean;
  showAvatar?: boolean;
  showEmail?: boolean;
  showColorIndicator?: boolean;
  placeholder?: string;
  loadingText?: string;
  emptyText?: string;
}

export function ActionValueSelector({
  actionType,
  value,
  onChange,
  options = [],
  isLoading = false,
  showAvatar = false,
  showEmail = false,
  showColorIndicator = false,
  placeholder = "Select option",
  loadingText = "Loading...",
  emptyText = "No options available",
}: ActionValueSelectorProps) {
  // Avatar component with fallback handling
  const Avatar = ({ src, label }: { src: string | null | undefined; label: string }) => {
    const [imgError, setImgError] = React.useState(false);

    if (!src || imgError) {
      return (
        <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] flex items-center justify-center font-medium">
          {label.charAt(0).toUpperCase()}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={label}
        className="w-5 h-5 rounded-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  };

  // Larger avatar for dropdown items
  const AvatarLarge = ({ src, label }: { src: string | null | undefined; label: string }) => {
    const [imgError, setImgError] = React.useState(false);

    if (!src || imgError) {
      return (
        <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
          {label.charAt(0).toUpperCase()}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={label}
        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
        onError={() => setImgError(true)}
      />
    );
  };

  if (actionType === "markAsSpam") {
    return (
      <div className="flex-1 text-sm text-[var(--muted-foreground)]/60">
        Message will be marked as spam
      </div>
    );
  }

  if (actionType === "autoReply") {
    return (
      <textarea
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter auto-reply message template..."
        className="flex-1 min-h-[80px] px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 resize-y"
        rows={3}
      />
    );
  }

  // Render selected item in trigger
  const renderSelectedValue = () => {
    if (!value || options.length === 0) {
      return (
        <span className="text-[var(--muted-foreground)]">
          {isLoading ? loadingText : placeholder}
        </span>
      );
    }

    const selected = options.find((opt) => opt.id === value || opt.value === value);
    if (!selected) {
      return <span className="text-[var(--muted-foreground)]">{placeholder}</span>;
    }

    return (
      <div className="flex items-center gap-2">
        {/* Avatar */}
        {showAvatar && <Avatar src={selected.avatar} label={selected.label} />}

        {/* Color indicator */}
        {showColorIndicator && (
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: selected.color || "#6b7280" }}
          />
        )}

        <span className="truncate">{selected.label}</span>
      </div>
    );
  };

  // Render dropdown items
  const renderDropdownItem = (option: (typeof options)[0]) => {
    return (
      <div className="flex items-center gap-2 py-1">
        {/* Avatar */}
        {showAvatar && <AvatarLarge src={option.avatar} label={option.label} />}

        {/* Color indicator */}
        {showColorIndicator && (
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: option.color || "#6b7280" }}
          />
        )}

        {/* Label and email */}
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={`font-medium text-sm truncate ${showColorIndicator ? "capitalize" : ""}`}
          >
            {option.label}
          </span>
          {showEmail && option.email && (
            <span className="text-xs text-[var(--muted-foreground)] truncate">{option.email}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Select value={value as string} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger className="flex-1 border border-[var(--border)]">
        <SelectValue asChild>{renderSelectedValue()}</SelectValue>
      </SelectTrigger>

      <SelectContent className="bg-[var(--card)] border border-[var(--border)]">
        {isLoading ? (
          <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">{loadingText}</div>
        ) : options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">{emptyText}</div>
        ) : (
          options.map((option) => (
            <SelectItem
              key={option.id}
              value={option.id || option.value}
              className="hover:bg-[var(--hover-bg)] cursor-pointer"
            >
              {renderDropdownItem(option)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
