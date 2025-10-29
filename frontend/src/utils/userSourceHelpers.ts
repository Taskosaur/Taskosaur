/**
 * Utilities for handling user source types
 */

import { UserSource } from "@/types/users";

/**
 * Get icon for user source type
 */
export const getUserSourceIcon = (source?: UserSource): string => {
  const icons: Record<UserSource, string> = {
    EMAIL_INBOX: "📧",
    SSO: "🔑",
    API: "🔌",
    IMPORT: "📥",
    SIGNUP: "✍️",
    MANUAL: "👤",
  };
  return icons[source || "MANUAL"];
};

/**
 * Get human-readable label for user source
 */
export const getUserSourceLabel = (source?: UserSource): string => {
  const labels: Record<UserSource, string> = {
    EMAIL_INBOX: "Email",
    SSO: "SSO",
    API: "API",
    IMPORT: "Imported",
    SIGNUP: "Signup",
    MANUAL: "Manual",
  };
  return labels[source || "MANUAL"];
};

/**
 * Get full description for user source
 */
export const getUserSourceDescription = (source?: UserSource): string => {
  const descriptions: Record<UserSource, string> = {
    EMAIL_INBOX: "External user created from shared inbox email",
    SSO: "User authenticated via Single Sign-On",
    API: "User created via API",
    IMPORT: "User imported from external system",
    SIGNUP: "User self-registered",
    MANUAL: "User manually invited or created by admin",
  };
  return descriptions[source || "MANUAL"];
};

/**
 * Get CSS class for user source badge
 */
export const getUserSourceBadgeClass = (source?: UserSource): string => {
  const classes: Record<UserSource, string> = {
    EMAIL_INBOX: "bg-blue-100 text-blue-800 border-blue-300",
    SSO: "bg-purple-100 text-purple-800 border-purple-300",
    API: "bg-green-100 text-green-800 border-green-300",
    IMPORT: "bg-orange-100 text-orange-800 border-orange-300",
    SIGNUP: "bg-cyan-100 text-cyan-800 border-cyan-300",
    MANUAL: "bg-gray-100 text-gray-800 border-gray-300",
  };
  return classes[source || "MANUAL"];
};

/**
 * Check if user is an external user (created from email)
 */
export const isExternalUser = (source?: UserSource): boolean => {
  return source === "EMAIL_INBOX";
};

/**
 * Get all available user sources for filtering
 */
export const getAllUserSources = (): Array<{ value: UserSource; label: string; icon: string }> => {
  return [
    { value: "MANUAL", label: "Manual/Invited", icon: "👤" },
    { value: "EMAIL_INBOX", label: "Email (External)", icon: "📧" },
    { value: "SSO", label: "Single Sign-On", icon: "🔑" },
    { value: "API", label: "API Created", icon: "🔌" },
    { value: "IMPORT", label: "Imported", icon: "📥" },
    { value: "SIGNUP", label: "Self-Registered", icon: "✍️" },
  ];
};
