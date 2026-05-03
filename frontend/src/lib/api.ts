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
  _useCache?: boolean; // NEW: Enable request deduplication and caching (default: true for GET)
  _cacheTTL?: number; // NEW: Override default cache TTL (ms)
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

// Token expiry configuration (match backend JWT_EXPIRES_IN)
const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // Refresh if less than 2 minutes remaining

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

  getTokenTimestamp: (): number | null => {
    try {
      if (typeof window === "undefined") return null;
      const timestamp = localStorage.getItem("token_timestamp");
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      return null;
    }
  },

  isTokenExpiringSoon: (): boolean => {
    const timestamp = TokenManager.getTokenTimestamp();
    if (!timestamp) return true; // No timestamp means we should refresh
    const elapsed = Date.now() - timestamp;
    return elapsed >= TOKEN_EXPIRY_MS - TOKEN_REFRESH_THRESHOLD_MS;
  },

  // Refresh token is now managed by the backend as an httpOnly cookie.
  // It is sent automatically with requests via withCredentials: true.
  // These methods are kept for backward compatibility with callers.
  getRefreshToken: (): string | null => {
    // Cannot read httpOnly cookie from JS — return a marker if we believe
    // a session exists (access_token is present), so callers don't bail out early.
    try {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("access_token") ? "httponly" : null;
    } catch (error) {
      console.warn("Failed to check refresh token:", error);
      return null;
    }
  },

  setRefreshToken: (_token: string): void => {
    // No-op: refresh token is now set by the backend as an httpOnly cookie
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
        // Remove legacy client-side cookie if it exists from before httpOnly migration
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
      const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/404", "/public", "/setup"];

      // Don't redirect if already on a public page or 404
      // Use some() with startsWith to catch sub-routes like /public/task/...
      if (!publicPaths.some((path) => currentPath === path || currentPath.startsWith(path + "/") || currentPath.startsWith(path))) {
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
    // Refresh token is sent automatically as an httpOnly cookie via withCredentials
    const response = await axios.post<AuthTokenResponse>(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api"}/auth/refresh`,
      {},
      {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
        timeout: 5000,
      }
    );

    const { access_token } = response.data;

    if (!access_token) {
      throw new ApiAuthError("Invalid token response", 401);
    }

    TokenManager.setAccessToken(access_token);

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

// Proactive token refresh - ensures we have a valid token before making requests
let proactiveRefreshPromise: Promise<string | null> | null = null;

const ensureValidToken = async (): Promise<string | null> => {
  const token = TokenManager.getAccessToken();

  // No token - nothing to refresh proactively
  if (!token) return null;

  // Token is still fresh - no need to refresh
  if (!TokenManager.isTokenExpiringSoon()) return token;

  // Already refreshing - wait for it
  if (isRefreshing || proactiveRefreshPromise) {
    try {
      return await (proactiveRefreshPromise || refreshPromise);
    } catch {
      return token; // Return old token, let the 401 handler deal with it
    }
  }

  // Proactively refresh the token
  try {
    proactiveRefreshPromise = refreshTokens();
    const newToken = await proactiveRefreshPromise;
    return newToken;
  } catch {
    // Proactive refresh failed - return old token, let the 401 handler deal with it
    return token;
  } finally {
    proactiveRefreshPromise = null;
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

// Request interceptor with proactive token refresh
// --- Request Deduplication and Caching Logic ---
const DEFAULT_CACHE_TTL = 2000; // 2 seconds
const pendingRequests = new Map<string, Promise<AxiosResponse>>();
const requestCache = new Map<string, { data: AxiosResponse; expiry: number }>();

// Generate unique key for request caching/deduplication
const generateCacheKey = (url: string, config?: AxiosRequestConfig) => {
  const params = config?.params;
  let paramsStr = "";

  if (params && typeof params === "object") {
    // Sort keys and filter out undefined/null to ensure consistent cache keys
    const sortedParams = Object.keys(params)
      .sort()
      .filter((key) => params[key] !== undefined && params[key] !== null)
      .reduce((acc: any, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    paramsStr = JSON.stringify(sortedParams);
  }

  // Normalize URL: Remove leading/trailing slashes and handle potential double slashes
  const normalizedUrl = url.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");

  return `GET:${normalizedUrl}:${paramsStr}`;
};

// Original api.request reference
const originalApiRequest = api.request.bind(api) as <T = any, R = AxiosResponse<T>, D = any>(
  config: AxiosRequestConfig<D>
) => Promise<R>;

/**
 * Enhanced api.request with deduplication and caching.
 * Deduplication: Collapses identical concurrent requests into one.
 * Caching: Briefly caches GET results to handle rapid duplicate mounts.
 */
api.request = (async function <T = any, R = AxiosResponse<T>, D = any>(
  config: AxiosRequestConfig<D>
): Promise<R> {
  const method = (config.method || "GET").toUpperCase();
  const useCache = (config as any)?._useCache !== false && method === "GET";
  const cacheTTL = (config as any)?._cacheTTL || DEFAULT_CACHE_TTL;

  if (!useCache) {
    return originalApiRequest<T, R, D>(config);
  }

  const cacheKey = generateCacheKey(config.url || "", config);
  const now = Date.now();

  // 1. Check if we have a valid cached response
  const cachedEntry = requestCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiry > now) {
    return Promise.resolve(cachedEntry.data as unknown as R);
  }

  // 2. Check if there's already an identical request in flight
  const existingRequest = pendingRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest as unknown as Promise<R>;
  }

  // 3. Fire new request and store its promise for deduplication
  const requestPromise = originalApiRequest<T, R, D>(config)
    .then((response) => {
      // Successful response: cache it
      requestCache.set(cacheKey, {
        data: response as unknown as AxiosResponse,
        expiry: Date.now() + cacheTTL,
      });
      return response;
    })
    .catch((error) => {
      // Errors are NOT cached to allow retry
      throw error;
    })
    .finally(() => {
      // Remove from pending once complete
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, requestPromise as unknown as Promise<AxiosResponse>);

  return requestPromise as unknown as Promise<R>;
} as any);
// -----------------------------------------------

// Request interceptor
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Don't add token for public endpoints to avoid 401s from stale tokens
      const isPublicEndpoint =
        config.url?.includes("/public/") ||
        config.url?.includes("/users/exists") ||
        config.url?.includes("/auth/setup") ||
        config.url?.includes("/auth/registration-status") ||
        config.url?.includes("/auth/oidc/") ||
        config.url?.includes("/auth/refresh"); // Don't try to refresh during refresh

      if (!isPublicEndpoint) {
        // Proactively refresh token if it's about to expire
        const token = await ensureValidToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      const orgId = TokenManager.getCurrentOrgId();
      if (orgId && config.headers) {
        config.headers["X-Organization-ID"] = orgId;
      }

      // For FormData, remove Content-Type so the browser sets it with the
      // correct multipart/form-data boundary. The instance default
      // (application/json) must not reach the server for file uploads.
      if (config.data instanceof FormData && config.headers) {
        config.headers.delete("Content-Type");
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
