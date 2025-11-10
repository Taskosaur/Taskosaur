import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: number | string | ReactNode;
  isLoading?: boolean;
  loadingPlaceholder?: ReactNode;
  statSuffix?: string | any; // e.g., "Active", "Total"
}

export function StatCard({
  icon,
  label,
  value,
  isLoading = false,
  loadingPlaceholder = <span className="dashboard-loading-placeholder" />,
  statSuffix,
}: StatCardProps) {
  return (
    <div className="dashboard-stat-card">
      <Card className="dashboard-stat-card-inner">
        <CardContent className="dashboard-stat-content">
          <div className="dashboard-stat-header">
            <div className="dashboard-stat-indicator" />
            <h3 className="dashboard-stat-title">{label}</h3>
          </div>
          <div className="dashboard-single-stat-values">
            <span className="dashboard-stat-number">{isLoading ? loadingPlaceholder : value}</span>
            <div className="dashboard-stat-icon">{icon}</div>
            {statSuffix && <span className="dashboard-stat-label-inline">{statSuffix}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
