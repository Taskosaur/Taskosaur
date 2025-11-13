import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { authApi } from "@/utils/api/authApi";

export default function SetupChecker({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSetupStatus = async () => {
      // Skip setup check for certain routes where it's not needed
      const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/terms-of-service", "/privacy-policy"];
      const isPublicRoute = publicRoutes.includes(router.pathname);

      try {
        // Check if any users exist in the system
        const { exists } = await authApi.checkUsersExist();
        if (!exists) {
          // No users exist - system needs initial setup
          if (router.pathname !== "/setup") {
            setShouldRedirect(true);
            router.push("/setup");
            return;
          }
        } else {
          // If user is trying to access setup page when setup is complete, redirect to login
          if (router.pathname.includes("/setup")) {
            router.push("/login");
            return;
          }
        }
      } catch (error) {
        console.error("Error checking setup status:", error);
      } finally {
        setIsChecking(false);
      }
    };

    // Only run on initial mount and when pathname changes
    if (isChecking || shouldRedirect) {
      checkSetupStatus();
    }
  }, [router.pathname]);

  // Show loading while checking setup status on initial load
  if (isChecking && !shouldRedirect) {
    return (
      <div className="setup-checker-loading-container">
        <div className="setup-checker-loading-content">
          <div className="setup-checker-loading-spinner"></div>
          <p className="setup-checker-loading-text">Checking system status...</p>
        </div>
      </div>
    );
  }

  // Always render children - redirection is handled above
  return <>{children}</>;
}
