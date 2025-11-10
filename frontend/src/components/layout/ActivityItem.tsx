import React from "react";

interface ActivityItemProps {
  icon: React.ReactNode;
  title: string;
  time: string;
  iconBg?: string;
  className?: string;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  icon,
  title,
  time,
  iconBg = "bg-[var(--muted)] text-[var(--muted-foreground)]",
  className = "",
}) => {
  return (
    <div className={`layout-activity-item ${className}`}>
      <div
        className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--foreground)] truncate mb-1 leading-tight">
          {title}
        </p>
        <p className="text-xs text-[var(--muted-foreground)] opacity-75">{time}</p>
      </div>
    </div>
  );
};
