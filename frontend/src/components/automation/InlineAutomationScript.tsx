/**
 * InlineAutomationScript component
 * 
 * Initializes the automation system using TypeScript modules
 * This ensures the script is always available without external dependencies
 */

import { useEffect } from 'react';
import { automation, enableBrowserConsoleAccess } from '@/utils/automation';

interface InlineAutomationScriptProps {
  enabled?: boolean;
}

export default function InlineAutomationScript({
  enabled = process.env.NODE_ENV === 'development'
}: InlineAutomationScriptProps) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Check if automation is already loaded
    if ((window as any).TaskosaurAutomation) {
      // console.log('🤖 Taskosaur Automation already loaded');
      return;
    }

    const initializeAutomation = async () => {
      try {
        // console.log('🔧 Initializing Taskosaur Automation System...');
        
        // Initialize the TypeScript automation system
        await automation.initialize();

        // Enable browser console access
        enableBrowserConsoleAccess();
        
        // console.log('✅ Taskosaur Automation System initialized successfully');
        // console.log('Result:', result);
        
      } catch (error) {
        console.error('❌ Failed to initialize automation system:', error);
      }
    };

    initializeAutomation();
  }, [enabled]);

  // This component doesn't render anything
  return null;
}