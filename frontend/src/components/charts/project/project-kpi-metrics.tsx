import { StatCard } from "@/components/common/StatCard";
import { CheckCircle, AlertTriangle, TrendingUp, Bug, Zap } from "lucide-react";
interface ProjectKPIMetricsProps {
  data: {
    totalTasks: number;
    completedTasks: number;
    activeSprints: number;
    totalBugs: number;
    resolvedBugs: number;
    completionRate: number;
    bugResolutionRate: number;
  };
}

export function ProjectKPIMetrics({ data }: ProjectKPIMetricsProps) {
  const kpiCards = [
    {
      title: "Total Tasks",
      label: "Tasks", // 👈 Added
      value: data?.totalTasks,
      description: "All tasks in project",
      icon: <CheckCircle className="h-4 w-4" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Completed Tasks",
      label: "Completed Tasks", // 👈 Added
      value: data?.completedTasks,
      description: "Successfully finished",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      title: "Active Sprints",
      label: "Active Sprints", // 👈 Added
      value: data?.activeSprints,
      description: "Currently running",
      icon: <Zap className="h-4 w-4" />,
      color: "text-purple-600",
    },
    {
      title: "Bug Resolution",
      label: "Bug Resolution", // 👈 Added
      value: `${data?.bugResolutionRate.toFixed(1)}%`,
      description: `${data?.resolvedBugs}/${data?.totalBugs} bugs fixed`,
      icon: <Bug className="h-4 w-4" />,
    },
    {
      title: "Task Completion",
      label: "Task Completion", // 👈 Added
      value: `${data?.completionRate.toFixed(1)}%`,
      description: "Overall progress",
      icon:
        data?.completionRate > 75 ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        ),
    },
    {
      title: "Open Bugs",
      label: "Open Bugs", // 👈 Added
      value: data?.totalBugs - data?.resolvedBugs,
      description: "Requiring attention",
      icon:
        data?.totalBugs - data?.resolvedBugs === 0 ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Bug className="h-4 w-4" />
        ),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiCards.map((card, index) => (
        <StatCard key={index} {...card} />
      ))}
    </div>
  );
}
