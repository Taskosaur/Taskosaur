/**
 * Hook to dynamically initialize the automation system using TypeScript modules
 */

import { useEffect, useState } from "react";
import { automation, enableBrowserConsoleAccess } from "@/utils/automation";

interface UseAutomationScriptOptions {
  enabled?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function useAutomationScript(options: UseAutomationScriptOptions = {}) {
  const { enabled = process.env.NODE_ENV === "development", onLoad, onError } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const initializeAutomation = async () => {
      try {
        // Initialize the TypeScript automation system
        await automation.initialize();

        // Enable browser console access
        enableBrowserConsoleAccess();

        setIsLoaded(true);
        onLoad?.();
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to initialize automation system");
        setError(error);
        onError?.(error);
      }
    };

    initializeAutomation();
  }, [enabled, onLoad, onError]);

  return {
    isLoaded,
    error,
    isAutomationAvailable:
      isLoaded && typeof window !== "undefined" && !!(window as any).TaskosaurAutomation,
  };
}
