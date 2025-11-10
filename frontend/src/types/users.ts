/**
 * Types related to Users/Members
 */

export interface Member {
  id?: string;
  name?: string;
  role?: string;
  avatar?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  status?: string;
  avatarUrl?: string;
  joinedAt?: string;
  lastActive?: string;
  userId: string;
  source?: UserSource;
}

export type UserSource =
  | "MANUAL" // Created manually by admin or through invitation
  | "EMAIL_INBOX" // Auto-created from shared inbox email
  | "SSO" // Created via Single Sign-On
  | "API" // Created via API
  | "IMPORT" // Bulk imported
  | "SIGNUP"; // Self-registered

export interface User {
  id: string;
  email?: string;
  firstName: string;
  lastName: string;
  username?: string;
  avatar?: string;
  bio?: string;
  mobileNumber?: string;
  timezone?: string;
  language?: string;
  role?: "SUPER_ADMIN" | "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | string;
  lastLoginAt?: string;
  emailVerified?: boolean;
  preferences?: any;
  createdAt?: string;
  updatedAt?: string;
  onboardInfo?: { [key: string]: string };
  source?: UserSource;
}
