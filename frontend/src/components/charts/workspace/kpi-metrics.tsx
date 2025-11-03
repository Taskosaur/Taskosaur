// components/charts/workspace/kpi-metrics.tsx
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";

interface KPIMetricsProps {
  data: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
}

export function KPIMetrics({ data }: KPIMetricsProps) {
  const kpiCards = [
    {
      label: "Total Projects",
      value: data?.totalProjects,
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      label: "Active Projects",
      value: data?.activeProjects,
      icon: <TrendingUp className="h-4 w-4" />,
      statSuffix:
        data?.totalProjects > 0
          ? `${((data?.activeProjects / data?.totalProjects) * 100).toFixed(1)}%`
          : "0%",
    },
    {
      label: "Completion Rate",
      value: `${data?.completionRate?.toFixed(1) || 0}%`,
      icon:
        data?.completionRate > 70 ? (
          <TrendingUp className="h-4 w-4 " />
        ) : (
          <TrendingDown className="h-4 w-4" />
        ),
      statSuffix: (
        <Badge
          variant={
            data?.completionRate > 70
              ? "default"
              : data?.completionRate > 50
                ? "secondary"
                : "destructive"
          }
          className="text-xs"
        >
          {data?.completionRate > 70
            ? "Excellent"
            : data?.completionRate > 50
              ? "Good"
              : "Needs Focus"}
        </Badge>
      ),
    },
    {
      label: "Total Tasks",
      value: data?.totalTasks,
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      label: "Overdue Tasks",
      value: data?.overdueTasks,
      icon:
        data?.overdueTasks > 0 ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        ),
      statSuffix: (
        <Badge variant={data?.overdueTasks === 0 ? "default" : "outline"} className="text-xs">
          {data?.overdueTasks === 0 ? "Perfect" : data?.overdueTasks < 10 ? "Good" : "Critical"}
        </Badge>
      ),
    },
    {
      label: "Task Health",
      value:
        data?.totalTasks > 0
          ? `${(((data?.totalTasks - data?.overdueTasks) / data?.totalTasks) * 100).toFixed(1)}%`
          : "0%",
      icon:
        data?.overdueTasks === 0 ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        ),
      statSuffix: (
        <Badge variant={data?.overdueTasks === 0 ? "default" : "outline"} className="text-xs">
          {data?.overdueTasks === 0 ? "Perfect" : "Monitor"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiCards.map((card, index) => (
        <StatCard
          key={index}
          label={card.label}
          value={card.value}
          icon={card.icon}
          // statSuffix={card.statSuffix as string}
        />
      ))}
    </div>
  );
}
