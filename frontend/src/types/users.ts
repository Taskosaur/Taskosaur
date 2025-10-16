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
}

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
  onboardInfo?: {[key: string]: string}
}
