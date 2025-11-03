import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi } from "@/utils/api/authApi";

export default function SetupChecker({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        // Check if any users exist in the system
        const { exists } = await authApi.checkUsersExist();

        if (!exists) {
          // Redirect to setup if not already there
          if (pathname !== "/setup") {
            router.push("/setup");
            return;
          }
        } else {
          // If user is trying to access setup page when setup is complete, redirect to login
          if (pathname === "/setup") {
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

    checkSetupStatus();
  }, []);

  // Show loading while checking setup status
  if (isChecking) {
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
