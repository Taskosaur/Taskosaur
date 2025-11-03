import { useAuth } from "@/contexts/auth-context";
import { TokenManager } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface AuthRedirectProps {
  children: React.ReactNode;
  redirectTo?: () => Promise<string>;
  requireAuth?: boolean;
}

export default function AuthRedirect({
  children,
  redirectTo = async () => "/dashboard",
  requireAuth = true,
}: AuthRedirectProps) {
  const {
    getCurrentUser,
    isAuthenticated: contextIsAuthenticated,
    isLoading: authLoading,
  } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowChildren, setShouldShowChildren] = useState(false);

  const checkAuthStatus = useCallback(() => {
    try {
      const isAuth = contextIsAuthenticated();
      const hasTokens = !!TokenManager.getAccessToken();
      const currentUser = getCurrentUser();

      const isFullyAuthenticated = isAuth && hasTokens && currentUser;

      return isFullyAuthenticated;
    } catch (error) {
      console.error("Auth status check error:", error);
      return false;
    }
  }, [contextIsAuthenticated, getCurrentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const performAuthCheck = async () => {
      try {
        const isAuthenticated = checkAuthStatus();

        if (requireAuth) {
          if (isAuthenticated) {
            router.push(await redirectTo());

            setShouldShowChildren(false);
          } else {
            setShouldShowChildren(true);
          }
        } else {
          setShouldShowChildren(true);
        }
      } catch {
        setShouldShowChildren(!requireAuth);
      } finally {
        setIsLoading(false);
      }
    };

    performAuthCheck();
  }, [authLoading, checkAuthStatus, requireAuth, redirectTo, router]);
  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border)] border-t-[var(--primary)]"></div>
          <p className="text-sm text-[var(--muted-foreground)]">Checking authentication...</p>
        </div>
      </div>
    );
  }
  if (!shouldShowChildren) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border)] border-t-[var(--primary)]"></div>
          <p className="text-sm text-[var(--muted-foreground)]">Redirecting...</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
