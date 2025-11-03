export interface WorkspaceAnalyticsProps {
  workspaceSlug: string;
}

export interface AnalyticsData {
  projectStatus: any[];
  taskPriority: any[];
  kpiMetrics: any;
  taskType: any[];
  sprintStatus: any[];
  monthlyCompletion: any[];
}

export interface Widget {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  dataKey: keyof AnalyticsData;
  visible: boolean;
  gridCols: string;
  priority: number;
}
