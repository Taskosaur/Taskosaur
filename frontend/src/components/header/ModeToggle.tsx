;

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import Tooltip from "../common/ToolTip";

import { CgDarkMode } from "react-icons/cg";
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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
      <CgDarkMode
        className="header-mode-toggle-icon"
      />

    </Button>
    </Tooltip>
  );
}
