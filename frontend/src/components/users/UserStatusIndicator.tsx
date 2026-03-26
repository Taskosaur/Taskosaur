import React from "react";
import { useUserStatus } from "@/hooks/useUserStatus";
import { formatLastSeen } from "@/hooks/useUserStatus";

export interface UserStatusIndicatorProps {
  userId: string;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * UserStatusIndicator Component
 * 
 * Displays a colored dot indicating whether a user is online or offline.
 * 
 * Features:
 * - Green dot for online users
 * - Gray dot for offline users
 * - Optional tooltip with last seen time
 * - Multiple size options
 * 
 * @example
 * ```tsx
 * <UserStatusIndicator userId="user-uuid" showTooltip />
 * ```
 */
export const UserStatusIndicator: React.FC<UserStatusIndicatorProps> = ({
  userId,
  showTooltip = false,
  size = "md",
  className = "",
}) => {
  const { isOnline, lastSeen, loading } = useUserStatus(userId);

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const statusColor = isOnline ? "bg-green-500" : "bg-gray-400";
  const statusRing = isOnline ? "ring-green-200" : "ring-gray-200";

  if (loading) {
    return (
      <span
        className={`${sizeClasses[size]} rounded-full bg-gray-300 animate-pulse ${className}`}
        aria-label="Loading status"
      />
    );
  }

  const indicator = (
    <span
      className={`${className} ${sizeClasses[size]} ${statusColor} rounded-full ring-2 ${statusRing}`}
      aria-label={isOnline ? "Online" : "Offline"}
    />
  );

  if (showTooltip) {
    return (
      <div className="relative group">
        {indicator}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {isOnline ? "Online" : formatLastSeen(lastSeen)}
        </div>
      </div>
    );
  }

  return indicator;
};

/**
 * UserStatusBadge Component
 * 
 * Displays a badge with text indicating user's online status.
 * 
 * @example
 * ```tsx
 * <UserStatusBadge userId="user-uuid" />
 * ```
 */
export const UserStatusBadge: React.FC<{ userId: string; className?: string }> = ({
  userId,
  className = "",
}) => {
  const { isOnline, lastSeen, loading } = useUserStatus(userId);

  if (loading) {
    return (
      <span className="text-xs text-gray-500 animate-pulse">Loading...</span>
    );
  }

  return (
    <span
      className={`text-xs ${
        isOnline ? "text-green-600" : "text-gray-500"
      } ${className}`}
    >
      {isOnline ? "Online" : formatLastSeen(lastSeen)}
    </span>
  );
};

/**
 * UserAvatarWithStatus Component
 * 
 * Combines user avatar with online status indicator.
 * 
 * @example
 * ```tsx
 * <UserAvatarWithStatus 
 *   userId="user-uuid"
 *   avatarUrl="https://..."
 *   userName="John Doe"
 * />
 * ```
 */
export const UserAvatarWithStatus: React.FC<{
  userId: string;
  avatarUrl?: string | null;
  userName?: string;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  className?: string;
}> = ({
  userId,
  avatarUrl,
  userName,
  size = "md",
  showStatus = true,
  className = "",
}) => {
  const { isOnline } = useUserStatus(userId);

  const avatarSizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const statusSizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const statusPosition = {
    sm: "-bottom-0.5 -right-0.5",
    md: "-bottom-0.5 -right-0.5",
    lg: "-bottom-1 -right-1",
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <img
        src={avatarUrl || "/default-avatar.png"}
        alt={userName || "User"}
        className={`${avatarSizes[size]} rounded-full object-cover`}
      />
      {showStatus && (
        <span
          className={`absolute ${statusPosition[size]} ${
            statusSizes[size]
          } ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          } rounded-full ring-2 ring-white`}
          aria-label={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
};
