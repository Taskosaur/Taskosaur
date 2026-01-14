import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: number | string | ReactNode;
  isLoading?: boolean;
  loadingPlaceholder?: ReactNode;
  statSuffix?: string | any; // e.g., "Active", "Total"
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  isLoading = false,
  loadingPlaceholder = <span className="dashboard-loading-placeholder" />,
  statSuffix,
  className,
}: StatCardProps) {
  return (
    <div className={`dashboard-stat-card transition-all duration-300 hover:translate-y-[-2px] ${className || ""}`}>
      <Card className="dashboard-stat-card-inner transition-colors duration-300 hover:bg-accent/50 group">
        <CardContent className="dashboard-stat-content">
          <div className="dashboard-stat-header">
            <div className="dashboard-stat-indicator transition-all duration-300 group-hover:h-3 group-hover:bg-primary" />
            <h3 className="dashboard-stat-title">{label}</h3>
          </div>
          <div className="dashboard-single-stat-values">
            <span className="dashboard-stat-number">{isLoading ? loadingPlaceholder : value}</span>
            <div className="dashboard-stat-icon transition-transform duration-300 group-hover:scale-110 group-hover:text-primary">{icon}</div>
            {statSuffix && <span className="dashboard-stat-label-inline">{statSuffix}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
