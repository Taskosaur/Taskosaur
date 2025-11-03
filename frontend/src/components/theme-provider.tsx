// app/providers.tsx or similar

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class" // 👈 REQUIRED to toggle `.dark` on <html>
      defaultTheme="system" // Optional: can be "light", "dark", or "system"
      enableSystem={true} // Enables system preference
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
