import React from "react";
import Link from "next/link";

interface ViewTab {
  name: string;
  key: string;
  icon: React.ReactNode;
  href: string;
}

interface ViewTabsProps {
  tabs: ViewTab[];
  currentView: string;
  variant?: "cards" | "bordered";
  className?: string;
}

const ViewTabs: React.FC<ViewTabsProps> = ({
  tabs,
  currentView,
  variant = "bordered",
  className = "",
}) => {
  const baseClasses =
    variant === "cards"
      ? "flex gap-2 p-2 bg-[var(--muted)] rounded-md shadow-sm border-none"
      : "flex border-b border-[var(--border)] bg-[var(--card)] rounded-md";

  const tabClasses =
    variant === "cards"
      ? "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors border-none"
      : "flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors";

  const activeClasses =
    variant === "cards"
      ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm border-none"
      : "border-[var(--primary)] text-[var(--primary)] dark:text-[var(--primary)]";

  const inactiveClasses =
    variant === "cards"
      ? "text-[var(--muted-foreground)] hover:text-[var(--primary)] dark:hover:text-[var(--primary)]"
      : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--primary)] dark:hover:text-[var(--primary)] hover:border-[var(--border)]";

  return (
    <div className={`${baseClasses} ${className}`}>
      {tabs.map((tab) => {
        const isActive = currentView === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`${tabClasses} ${isActive ? activeClasses : inactiveClasses}`}
          >
            {tab.icon}
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
};

export default ViewTabs;
