import type { User } from "./users";

export interface UserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface UploadFileResponse {
  url: string | null;
  key: string;
  size: number;
  inCloud: boolean;
}

export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

export interface SetupAdminData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
}

export interface SetupStatusResponse {
  required: boolean;
  canSetup: boolean;
  message?: string;
}

export interface SetupResponse {
  success: boolean;
  message: string;
  user: User;
}

export interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: User;
  message?: string;
}
