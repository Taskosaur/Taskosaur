/**
 * InlineAutomationScript component
 *
 * Initializes the automation system using TypeScript modules
 * This ensures the script is always available without external dependencies
 */

import { useEffect } from "react";
import { automation, enableBrowserConsoleAccess } from "@/utils/automation";

interface InlineAutomationScriptProps {
  enabled?: boolean;
}

export default function InlineAutomationScript({
  enabled = process.env.NODE_ENV === "development",
}: InlineAutomationScriptProps) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Check if automation is already loaded
    if ((window as any).TaskosaurAutomation) {
      return;
    }

    const initializeAutomation = async () => {
      try {
        // Initialize the TypeScript automation system
        await automation.initialize();

        // Enable browser console access
        enableBrowserConsoleAccess();
      } catch (error) {
        console.error("❌ Failed to initialize automation system:", error);
      }
    };

    initializeAutomation();
  }, [enabled]);

  return null;
}
