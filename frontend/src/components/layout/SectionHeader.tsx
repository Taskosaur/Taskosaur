import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  className = "",
}) => {
  return (
    <div className={`layout-section-header-container ${className}`}>
      <div className="layout-section-header-content">
        <h2 className="layout-section-header-title">{title}</h2>
        {subtitle && <p className="layout-section-header-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="layout-section-header-action">{action}</div>}
    </div>
  );
};
