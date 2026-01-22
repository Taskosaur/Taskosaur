import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import "@/styles/globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/contexts/auth-context";
import SetupChecker from "@/components/setup/SetupChecker";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ChatProvider from "@/contexts/chat-context";
import ChatPanel from "@/components/chat/ChatPanel";
import { Toaster } from "@/components/ui/sonner";
import { SEO } from "@/components/common/SEO";

function useExposeRouter() {
  const router = useRouter();

  useEffect(() => {
    (window as any).__NEXT_ROUTER__ = router;
  }, [router]);
}

export default function MyApp({ Component, pageProps }: AppProps) {
  // Expose router globally for automation to use
  useExposeRouter();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SEO />
      <AuthProvider>
        <SetupChecker>
          <ChatProvider>
            <ProtectedRoute>
              <Component {...pageProps} />
            </ProtectedRoute>
            <ChatPanel />
          </ChatProvider>
        </SetupChecker>
      </AuthProvider>
      <Toaster expand={false} richColors closeButton />
    </ThemeProvider>
  );
}
