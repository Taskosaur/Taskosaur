import axios, {
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosRequestConfig,
} from "axios";
import Cookies from "js-cookie";

// Enhanced interfaces
interface AuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: any;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
  code?: string;
  details?: any;
  statusCode?: number;
}

interface ApiError {
  message: string;
  status?: number;
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
}

// Extended interface with 404 redirect option
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
  _skipErrorHandling?: boolean;
  _handle404Redirect?: boolean; // NEW: Enable 404 redirect for specific requests
}

// Custom error classes
class ApiAuthError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

class ApiNetworkError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = "ApiNetworkError";
  }
}

class ApiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiTimeoutError";
  }
}

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000;

// Global state management
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (error: any) => void;
}> = [];

// Process failed queue when refresh completes
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

// Enhanced Token Manager
const TokenManager = {
  getAccessToken: (): string | null => {
    try {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("access_token");
    } catch (error) {
      console.warn("Failed to get access token:", error);
      return null;
    }
  },

  setAccessToken: (token: string): void => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", token);
        localStorage.setItem("token_timestamp", Date.now().toString());
      }
    } catch (error) {
      console.error("Failed to set access token:", error);
    }
  },

  getRefreshToken: (): string | null => {
    try {
      if (typeof window === "undefined") return null;
      return Cookies.get("refresh_token") || null;
    } catch (error) {
      console.warn("Failed to get refresh token:", error);
      return null;
    }
  },

  setRefreshToken: (token: string): void => {
    try {
      if (typeof window !== "undefined") {
        Cookies.set("refresh_token", token, {
          expires: 30, // 30 days
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          httpOnly: false,
        });
      }
    } catch (error) {
      console.error("Failed to set refresh token:", error);
    }
  },

  getCurrentOrgId: (): string | null => {
    try {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("currentOrganizationId");
    } catch (error) {
      console.warn("Failed to get organization ID:", error);
      return null;
    }
  },

  setCurrentOrgId: (orgId: string): void => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("currentOrganizationId", orgId);
      }
    } catch (error) {
      console.error("Failed to set organization ID:", error);
    }
  },

  clearTokens: (): void => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_timestamp");
        localStorage.removeItem("currentOrganizationId");
        Cookies.remove("refresh_token", { path: "/" });
      }
    } catch (error) {
      console.error("Failed to clear tokens:", error);
    }
  },
};

const isApiErrorResponse = (data: any): data is ApiErrorResponse => {
  return data && typeof data === "object";
};

const isAxiosError = (error: any): error is AxiosError => {
  return error && error.isAxiosError === true;
};

// Enhanced error handling
const handleApiError = (error: AxiosError): ApiError => {
  let message = "An unexpected error occurred";
  let code: string | undefined;
  let isNetworkError = false;
  let isTimeoutError = false;

  try {
    // Network errors
    if (error.code === "NETWORK_ERROR" || error.code === "ERR_NETWORK") {
      isNetworkError = true;
      message = "Network connection failed. Please check your internet connection.";
    }
    // Timeout errors
    else if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      isTimeoutError = true;
      message = "Request timed out. Please try again.";
    }
    // Response errors
    else if (error.response?.data) {
      const data = error.response.data;

      if (isApiErrorResponse(data)) {
        message = data.message || data.error || message;
        code = data.code;
      } else if (typeof data === "string") {
        message = data;
      }
    }
    // Request errors
    else if (error.request) {
      isNetworkError = true;
      message = "No response received from server. Please try again.";
    }
    // Other errors
    else if (error.message) {
      message = error.message;
    }
  } catch (parseError) {
    console.error("Error parsing API error:", parseError);
    message = "An unexpected error occurred";
  }

  return {
    message,
    status: error.response?.status,
    code,
    isNetworkError,
    isTimeoutError,
  };
};

// Safe redirect function
const safeRedirect = (url: string): void => {
  try {
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/404"];

      // Don't redirect if already on a public page or 404
      if (!publicPaths.some((path) => currentPath.startsWith(path))) {
        // Use replace to avoid back button issues
        window.location.replace(url);
      }
    }
  } catch (error) {
    console.error("Failed to redirect:", error);
  }
};

// Refresh token function
const refreshTokens = async (): Promise<string> => {
  try {
    const refreshToken = TokenManager.getRefreshToken();

    if (!refreshToken) {
      throw new ApiAuthError("No refresh token available", 401);
    }

    const response = await axios.post<AuthTokenResponse>(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api"}/auth/refresh`,
      { refresh_token: refreshToken },
      {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
        timeout: 5000,
      }
    );

    const { access_token, refresh_token: newRefreshToken } = response.data;

    if (!access_token) {
      throw new ApiAuthError("Invalid token response", 401);
    }

    TokenManager.setAccessToken(access_token);
    if (newRefreshToken) {
      TokenManager.setRefreshToken(newRefreshToken);
    }

    return access_token;
  } catch (error) {
    TokenManager.clearTokens();

    if (isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new ApiAuthError("Session expired. Please log in again.", 401);
      } else if (error.code === "NETWORK_ERROR") {
        throw new ApiNetworkError("Network error during token refresh");
      }
    }

    throw new ApiAuthError("Failed to refresh authentication", 401);
  }
};

// Create axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      const token = TokenManager.getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const orgId = TokenManager.getCurrentOrgId();
      if (orgId && config.headers) {
        config.headers["X-Organization-ID"] = orgId;
      }

      return config;
    } catch (error) {
      console.error("Request interceptor error:", error);
      return config;
    }
  },
  (error: AxiosError) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(handleApiError(error));
  }
);

// Response interceptor with comprehensive error handling including 404 redirect
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Reset retry count on successful response
    if (response.config) {
      (response.config as any)._retryCount = 0;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig;

    try {
      // Skip error handling for specific requests
      if (originalRequest?._skipErrorHandling) {
        return Promise.reject(handleApiError(error));
      }
      // **Handle 404 errors - redirect to 404 page if configured**
      if (error.response?.status === 404 && originalRequest?._handle404Redirect) {
        // Only redirect if explicitly enabled for this request
        console.warn("Resource not found (404), redirecting to 404 page");
        safeRedirect("/404");
        // Always return the error for component-level handling
        return Promise.reject(handleApiError(error));
      }

      // Handle 401 errors (authentication)
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        // If already refreshing, add to queue
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers && token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(handleApiError(err));
            });
        }

        // Start refresh process
        isRefreshing = true;

        try {
          if (!refreshPromise) {
            refreshPromise = refreshTokens();
          }

          const newToken = await refreshPromise;
          processQueue(null, newToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }

          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          safeRedirect("/login");
          return Promise.reject(
            new ApiAuthError("Authentication failed. Please log in again.", 401)
          );
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      }

      // Handle retry logic for network errors
      const shouldRetry =
        error.code === "NETWORK_ERROR" ||
        error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED" ||
        (error.response?.status && error.response.status >= 500);

      if (shouldRetry && originalRequest) {
        const retryCount = (originalRequest._retryCount || 0) + 1;

        if (retryCount <= MAX_RETRY_ATTEMPTS) {
          originalRequest._retryCount = retryCount;

          // Exponential backoff
          const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);

          await new Promise((resolve) => setTimeout(resolve, delay));

          return api(originalRequest);
        }
      }

      // Handle other errors gracefully
      const apiError = handleApiError(error);
      return Promise.reject(apiError);
    } catch (interceptorError) {
      console.error("Response interceptor error:", interceptorError);
      return Promise.reject({
        message: "An unexpected error occurred",
        status: 500,
      } as ApiError);
    }
  }
);

// Safe API utility functions
export const apiUtils = {
  login: async (credentials: { email: string; password: string }): Promise<AuthTokenResponse> => {
    try {
      const response = await api.post<AuthTokenResponse>("/auth/login", credentials);
      const { access_token, refresh_token } = response.data;

      if (!access_token) {
        throw new ApiAuthError("Invalid login response", 400);
      }

      TokenManager.setAccessToken(access_token);
      if (refresh_token) {
        TokenManager.setRefreshToken(refresh_token);
      }

      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        throw handleApiError(error);
      }
      throw new ApiAuthError("Login failed", 500);
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post(
        "/auth/logout",
        {},
        {
          withCredentials: true,
          timeout: 5000,
        }
      );
    } catch (error) {
      console.warn("Logout API call failed:", error);
    } finally {
      TokenManager.clearTokens();
      safeRedirect("/login");
    }
  },

  isAuthenticated: (): boolean => {
    try {
      const token = TokenManager.getAccessToken();
      return !!token;
    } catch (error) {
      console.error("Authentication check failed:", error);
      return false;
    }
  },

  getCurrentUser: async (): Promise<any> => {
    try {
      const response = await api.get("/auth/me");
      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        TokenManager.clearTokens();
        safeRedirect("/login");
      }
      throw handleApiError(error as AxiosError);
    }
  },

  // Safe API request wrapper
  safeRequest: async <T = any>(
    config: AxiosRequestConfig
  ): Promise<{ data: T; error: null } | { data: null; error: ApiError }> => {
    try {
      const response = await api.request<T>(config);
      return { data: response.data, error: null };
    } catch (error) {
      console.error("API request failed:", error);

      if (isAxiosError(error)) {
        return { data: null, error: handleApiError(error) };
      }

      return {
        data: null,
        error: {
          message: "An unexpected error occurred",
          status: 500,
        },
      };
    }
  },
};

// Development logging
if (process.env.NODE_ENV === "development") {
  api.interceptors.request.use((request) => {
    return request;
  });

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
}

export default api;
export {
  TokenManager,
  ApiAuthError,
  ApiNetworkError,
  ApiTimeoutError,
  handleApiError,
  safeRedirect,
};
export type { AuthTokenResponse, ApiError, ApiErrorResponse, ExtendedAxiosRequestConfig };
