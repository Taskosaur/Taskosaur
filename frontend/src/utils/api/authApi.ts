import api, { TokenManager } from "@/lib/api";
import {
  ApiResponse,
  AuthResponse,
  ForgotPasswordData,
  LoginData,
  ResetPasswordData,
  SetupAdminData,
  SetupResponse,
  SetupStatusResponse,
  UploadFileResponse,
  User,
  UserData,
} from "@/types";
import validator from "validator";

// Utility functions for validation
function sanitizeToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: must be a non-empty string');
  }
  // Tokens should be alphanumeric and may include hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    throw new Error('Invalid token format');
  }
  return encodeURIComponent(token);
}

export const authApi = {
  login: async (loginData: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/login", loginData);

    const { access_token, refresh_token, user } = response.data;
    if (access_token) TokenManager.setAccessToken(access_token);
    if (refresh_token) TokenManager.setRefreshToken(refresh_token);
    if (user) localStorage.setItem("user", JSON.stringify(user));

    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post("/auth/logout", {}, { withCredentials: true });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  },
  resetPassword: async (data: ResetPasswordData): Promise<ApiResponse> => {
    try {
      const response = await api.post<ApiResponse>("/auth/reset-password", data);
      return response.data;
    } catch (error: any) {
      console.error("Reset password error:", error);
      throw new Error(error.message || "Failed to reset password");
    }
  },
  forgotPassword: async (data: ForgotPasswordData): Promise<ApiResponse> => {
    try {
      const response = await api.post<ApiResponse>("/auth/forgot-password", data);
      return response.data;
    } catch (error: any) {
      console.error("Forgot password error:", error);
      throw new Error(error.message || "Failed to send password reset email");
    }
  },
  validateResetToken: async (token: string): Promise<ApiResponse<{ valid: boolean }>> => {
    try {
      const sanitizedToken = sanitizeToken(token);
      const response = await api.get<ApiResponse<{ valid: boolean }>>(
        `/auth/verify-reset-token/${sanitizedToken}`
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to validate reset token",
        data: { valid: false },
      };
    }
  },

  getCurrentUser: (): User | null => {
    try {
      if (typeof window === "undefined") return null;

      const userString = localStorage.getItem("user");
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
      return null;
    }
  },

  getUserAccess: async (data: { name: string; id: string }): Promise<ApiResponse> => {
    try {
      const response = await api.get<ApiResponse>(
        `/auth/access-control?scope=${data.name}&id=${data.id}`
      );
      return response.data;
    } catch (error: any) {
      console.error("Error fetching user access", error);
      return {
        success: false,
        message: error.message || "Failed to fetch access",
      };
    }
  },

  getUserProfile: async (): Promise<User | null> => {
    try {
      const response = await api.get<User>("/auth/profile");
      const user = response.data;

      localStorage.setItem("user", JSON.stringify(user));
      return user;
    } catch (error) {
      console.error("Error refreshing user data:", error);
      return null;
    }
  },

  isAuthenticated: (): boolean => {
    if (typeof window === "undefined") return false;

    const user = authApi.getCurrentUser();
    const hasTokens = TokenManager.getAccessToken();
    return !!(hasTokens && user);
  },
  uploadFileToS3: async (file: File, folder: string): Promise<UploadFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await api.post(`/uploads/upload/${folder}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!uploadResponse.data) throw new Error("Upload failed");

    return {
      url: uploadResponse.data.url,
      key: uploadResponse.data.key,
      size: uploadResponse.data.size,
      inCloud: uploadResponse.data.inCloud,
    };
  },


  // Setup-related methods
  checkUsersExist: async (): Promise<{ exists: boolean }> => {
    const response = await api.get<{ exists: boolean }>("/users/exists");
    return response.data;
  },

  checkSetupStatus: async (): Promise<SetupStatusResponse> => {
    const response = await api.get<SetupStatusResponse>("/auth/setup/required");
    return response.data;
  },

  setupSuperAdmin: async (setupData: SetupAdminData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/setup", setupData);

    const { access_token, refresh_token, user } = response.data;

    if (access_token) TokenManager.setAccessToken(access_token);
    if (refresh_token) TokenManager.setRefreshToken(refresh_token);
    if (user) localStorage.setItem("user", JSON.stringify(user));

    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<ApiResponse> => {
    if (data.newPassword !== data.confirmPassword) {
      return {
        success: false,
        message: "New password and confirm password do not match.",
      };
    }
    try {
      const response = await api.post<ApiResponse>("/users/change-password", data);
      return response.data;
    } catch (error: any) {
      console.error("Change password error:", error);
      return {
        success: false,
        message: error.message || "Failed to change password",
      };
    }
  },

  register: async (userData: UserData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/register", userData);

    const { access_token, refresh_token, user } = response.data;

    if (access_token) TokenManager.setAccessToken(access_token);
    if (refresh_token) TokenManager.setRefreshToken(refresh_token);
    if (user) localStorage.setItem("user", JSON.stringify(user));

    return response.data;
  },
};
