import type { AppProps } from "next/app";
import "@/styles/globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/contexts/auth-context";
import SetupChecker from "@/components/setup/SetupChecker";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AutomationLoader from "@/components/automation/AutomationLoader";
import ChatProvider from "@/contexts/chat-context";
import ChatPanel from "@/components/chat/ChatPanel";
import { Toaster } from "@/components/ui/sonner";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SetupChecker>
        <AuthProvider>
          <ChatProvider>
            <ProtectedRoute>
              <Component {...pageProps} />
            </ProtectedRoute>
            <ChatPanel />
          </ChatProvider>
        </AuthProvider>
      </SetupChecker>
      <AutomationLoader
        enabled={process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_AUTOMATION === 'true'}
        showDevPanel={process.env.NODE_ENV === 'development'}
        enableConsoleAccess={true}
      />
      <Toaster expand={false} richColors closeButton />
    </ThemeProvider>
  );
}
