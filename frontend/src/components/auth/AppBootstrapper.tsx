import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/auth-context";
import { authApi } from "@/utils/api/authApi";
import { TokenManager } from "@/lib/api";
import SplashScreen from "../common/SplashScreen";
import AppProviders from "./AppProviders";
import OrgProviders from "./OrgProvider";
import PublicProviders from "./PublicProviders";
import { LayoutProvider } from "@/contexts/layout-context";
import i18n from "@/lib/i18n";

interface AppBootstrapperProps {
  children: React.ReactNode;
}

type InitPhase = "SYSTEM_CHECK" | "AUTH_CHECK" | "READY";

export default function AppBootstrapper({ children }: AppBootstrapperProps) {
  const router = useRouter();
  const {
    getCurrentUser,
    isAuthenticated: contextIsAuthenticated,
    isLoading: authLoading,
    checkOrganizationAndRedirect,
  } = useAuth();

  const [phase, setPhase] = useState<InitPhase>("SYSTEM_CHECK");
  const [statusText, setStatusText] = useState("Checking system status");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isInitialized = useRef(false);

  // Define public routes (merged from SetupChecker and ProtectedRoute)
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/terms-of-service",
    "/privacy-policy",
    "/setup",
    "/public/task/[token]",
    "/invite",
    "/invite/invalid"
  ];

  const handleSystemCheck = async () => {
    // Skip setup check on routes that don't need it
    const skipRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/terms-of-service", "/privacy-policy", "/public/"];
    const shouldSkip = skipRoutes.some(route => router.pathname.startsWith(route));

    if (shouldSkip || router.pathname === "/setup") {
      return true; // Already on a safe route or setup
    }

    try {
      const { exists } = await authApi.checkUsersExist();
      if (!exists) {
        setIsRedirecting(true);
        router.replace("/setup");
        return false;
      }
    } catch (error) {
      // Fallback check
      try {
        const setupStatus = await authApi.checkSetupStatus();
        if (setupStatus?.required) {
          setIsRedirecting(true);
          router.replace("/setup");
          return false;
        }
      } catch {
        // If everything fails, check if we have a token
        const hasToken = typeof window !== "undefined" && (
          localStorage.getItem("access_token") ||
          document.cookie.includes("access_token")
        );
        if (!hasToken) {
          setIsRedirecting(true);
          router.replace("/setup");
          return false;
        }
      }
    }
    return true;
  };

  const handleAuthCheck = useCallback(async () => {
    if (!router.isReady) return { isAuth: false, isOrg: false };

    const isPublicRoute = 
      publicRoutes.includes(router.pathname) || 
      router.pathname.startsWith("/public/task/") ||
      (typeof window !== "undefined" && window.location.pathname.startsWith("/public/"));

    const isProjectRoute = router.pathname.includes("/[workspaceSlug]/[projectSlug]") ||
      (typeof window !== "undefined" && /\/[^\/]+\/[^\/]+/.test(window.location.pathname) && !window.location.pathname.startsWith("/public/") && !window.location.pathname.startsWith("/admin"));
    
    const actualPath = typeof window !== "undefined" ? window.location.pathname : router.asPath.split("?")[0];
    const isSettingsOrMembersRoute = actualPath.endsWith("/settings") || actualPath.endsWith("/members");
    const isPublicProjectRoute = isProjectRoute && !isSettingsOrMembersRoute;

    try {
      const accessToken = TokenManager.getAccessToken();
      const currentOrgId = TokenManager.getCurrentOrgId();
      const currentUser = getCurrentUser();
      const contextAuth = typeof contextIsAuthenticated === "function" ? contextIsAuthenticated() : contextIsAuthenticated;

      const isAuth = !!(accessToken && currentUser && contextAuth);
      
      if (!isAuth) {
        if (isPublicRoute || isPublicProjectRoute) {
          return { isAuth: false, isOrg: false };
        }
        return { isAuth: false, redirectPath: "/login", isOrg: false };
      }

      if (isPublicRoute) {
        const authPages = ["/login", "/register", "/forgot-password", "/reset-password", "/setup"];
        if (!authPages.includes(router.pathname)) {
          return { isAuth: true, isOrg: true };
        }

        if (typeof checkOrganizationAndRedirect === "function") {
          const orgRedirect = await checkOrganizationAndRedirect();
          if (!currentOrgId && orgRedirect === "/organization") {
            return { isAuth: true, redirectPath: "/organization", isOrg: false };
          }
        }
        return { isAuth: true, redirectPath: "/dashboard", isOrg: true };
      }

      if (router.pathname.startsWith("/admin")) {
        return { isAuth: true, isOrg: true };
      }

      if (typeof checkOrganizationAndRedirect === "function") {
        const orgRedirect = await checkOrganizationAndRedirect();
        if (currentOrgId && router.pathname === "/organization") {
          return { isAuth: true, redirectPath: "/dashboard", isOrg: true };
        }
        if (!currentOrgId && orgRedirect === "/organization") {
          return { isAuth: true, redirectPath: "/organization", isOrg: false };
        }
      }
      return { isAuth: true, isOrg: true };
    } catch (error) {
      console.error("[AppBootstrapper] Auth check error:", error);
      return { isAuth: false, redirectPath: "/login", isOrg: false };
    }
  }, [router.isReady, router.pathname, contextIsAuthenticated, getCurrentUser, checkOrganizationAndRedirect]);

  useEffect(() => {
    if (authLoading || !router.isReady) return;

    const bootstrap = async () => {
      const needsFullBootstrap = !isInitialized.current;

      if (needsFullBootstrap) {
        // Phase 1: System Check
        setPhase("SYSTEM_CHECK");
        setStatusText("Verifying system integrity");
        const systemReady = await handleSystemCheck();
        if (!systemReady) return;

        // Phase 2: Auth Check
        setPhase("AUTH_CHECK");
        setStatusText("Authenticating session");
      }

      const { isAuth, redirectPath, isOrg } = await handleAuthCheck();
      
      setIsAuthenticated(isAuth);
      setHasOrganization(isOrg);

      if (redirectPath && redirectPath !== router.pathname) {
        setIsRedirecting(true);
        if (!isAuth && redirectPath === "/login") {
          TokenManager.clearTokens();
        }
        await router.replace(redirectPath);
        setIsRedirecting(false);
      }

      if (needsFullBootstrap) {
        // Phase 3: Ready
        setPhase("READY");
        isInitialized.current = true;
      }
    };

    bootstrap();
  }, [authLoading, router.isReady, handleAuthCheck]);

  // Synchronize language with user preference
  useEffect(() => {
    if (isAuthenticated) {
      const user = getCurrentUser();
      const targetLang = user?.language || "en";
      if (targetLang !== i18n.language) {
        i18n.changeLanguage(targetLang);
      }
    }
  }, [isAuthenticated, getCurrentUser]);

  // Handle Loading States
  if (phase !== "READY" || isRedirecting) {
    return <SplashScreen statusText={statusText} isExiting={phase === "READY"} />;
  }

  // Routing Logic (Same as ProtectedRoute)
  const isPublicRoute = publicRoutes.includes(router.pathname) || router.pathname.startsWith("/public/task/") || (typeof window !== "undefined" && window.location.pathname.startsWith("/public/"));
  const isProjectRoute = router.pathname.includes("/[workspaceSlug]/[projectSlug]") || (typeof window !== "undefined" && /\/[^\/]+\/[^\/]+/.test(window.location.pathname) && !window.location.pathname.startsWith("/public/") && !window.location.pathname.startsWith("/admin"));
  const actualPath = typeof window !== "undefined" ? window.location.pathname : router.asPath.split("?")[0];
  const isSettingsOrMembersRoute = actualPath.endsWith("/settings") || actualPath.endsWith("/members");
  const isPublicProjectRoute = isProjectRoute && !isSettingsOrMembersRoute;
  const is404 = router.pathname === "/404";

  if (is404 || isPublicRoute) {
    return <LayoutProvider>{children}</LayoutProvider>;
  }

  if (isPublicProjectRoute && !isAuthenticated) {
    return (
      <LayoutProvider>
        <PublicProviders>{children}</PublicProviders>
      </LayoutProvider>
    );
  }

  if (isAuthenticated && hasOrganization) {
    return <AppProviders>{children}</AppProviders>;
  }

  if (isAuthenticated && !hasOrganization) {
    return (
      <LayoutProvider>
        <OrgProviders>{children}</OrgProviders>
      </LayoutProvider>
    );
  }

  return null;
}
