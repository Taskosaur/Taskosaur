import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import Tooltip from "../common/ToolTip";

import { CgDarkMode } from "react-icons/cg";
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const isBrowser = typeof window !== "undefined";
  let hideThemeLabel = false;
  if (isBrowser) {
    const path = window.location.pathname;
    hideThemeLabel = path === "/login/" || path === "/register/";
  }

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Tooltip content="Toggle theme" position="bottom" color="primary">
      <Button
        onClick={handleToggle}
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        className="header-mode-toggle"
      >
        <CgDarkMode className="header-mode-toggle-icon" />
        {!hideThemeLabel && (
          <span className="hidden max-[530px]:inline-block text-sm font-medium">Theme</span>
        )}
      </Button>
    </Tooltip>
  );
}
