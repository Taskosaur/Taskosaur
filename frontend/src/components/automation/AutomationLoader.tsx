/**
 * AutomationLoader component
 *
 * Conditionally loads the automation system in development mode
 * or when explicitly enabled via environment variable
 */

import { useEffect, useState } from "react";

interface AutomationLoaderProps {
  enabled?: boolean;
  showDevPanel?: boolean;
  enableConsoleAccess?: boolean;
}

declare global {
  interface Window {
    TaskosaurAutomation: any;
  }
}

export default function AutomationLoader({
  enabled = true,
  showDevPanel = process.env.NODE_ENV === "development",
  enableConsoleAccess = true,
}: AutomationLoaderProps) {
  const [initResult, setInitResult] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Inline automation initialization to avoid hook issues
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const initializeAutomation = async () => {
      try {
        // Dynamic import of automation to avoid SSR issues
        const { automation, enableBrowserConsoleAccess } = await import("@/utils/automation");

        // Initialize the TypeScript automation system
        await automation.initialize();

        // Enable browser console access
        enableBrowserConsoleAccess();

        setIsLoaded(true);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to initialize automation system");
        setError(error);
        console.error("❌ Failed to initialize automation system:", err);
      }
    };

    initializeAutomation();
  }, [enabled]);

  const isAutomationAvailable =
    isLoaded && typeof window !== "undefined" && !!(window as any).TaskosaurAutomation;

  useEffect(() => {
    if (!isAutomationAvailable) return;

    const initializeAutomation = async () => {
      try {
        // Wait a bit for the script to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (window.TaskosaurAutomation) {
          const result = await window.TaskosaurAutomation.initialize();
          setInitResult(result);
        }
      } catch (error) {
        console.error("Failed to initialize automation system:", error);
        setInitResult({
          success: false,
          message: "Failed to initialize automation system",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    initializeAutomation();
  }, [isAutomationAvailable, enableConsoleAccess]);

  // Show error state if script failed to load
  if (enabled && error && showDevPanel) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-red-900 text-white p-3 rounded-lg shadow-lg text-sm max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="font-medium">Automation Error</span>
          </div>
          <div className="text-xs text-red-300">Failed to load automation script</div>
        </div>
      </div>
    );
  }

  // Only show dev panel in development and when automation is working
  if (!showDevPanel || !initResult?.success || !isAutomationAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 hidden">
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg text-sm max-w-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="font-medium">Automation Active</span>
        </div>
        <div className="text-xs text-gray-300">
          <div>Domain: {initResult.data?.domain}</div>
          <div>Auth: {initResult.data?.authenticated ? "✓" : "✗"}</div>
          <div>Context: {initResult.data?.context?.type}</div>
          <div>Source: TypeScript Modules</div>
        </div>
        <div className="mt-2 text-xs text-blue-300">Console: TaskosaurAutomation</div>
        <button
          onClick={() => {
            window.TaskosaurAutomation?.demos?.quickDemo?.();
          }}
          className="mt-1 text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition-colors"
        >
          Run Demo
        </button>
      </div>
    </div>
  );
}
