// components/charts/organization/member-workload-chart.tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  low: { label: "Low Workload", color: "#10B981" },
  medium: { label: "Medium Workload", color: "#F59E0B" },
  high: { label: "High Workload", color: "#EF4444" },
  assigned: { label: "Assigned Tasks", color: "#3B82F6" },
  reported: { label: "Reported Tasks", color: "#8B5CF6" },
};

interface MemberWorkloadChartProps {
  data: Array<{
    memberId: string;
    memberName: string;
    activeTasks: number;
    reportedTasks: number;
  }>;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    return (
      <div className="border-0 bg-[var(--accent)] p-3 border-gray-200 rounded-lg shadow-md">
        <p className="font-semibold">{data.memberName}</p>
        <p className="text-sm text-blue-600">{`Assigned Tasks: ${data.activeTasks}`}</p>
        <p className="text-sm text-purple-600">{`Reported Tasks: ${data.reportedTasks}`}</p>
        <p className="text-sm text-gray-500">
          {`Workload: ${data.activeTasks > 10 ? "High" : data.activeTasks > 5 ? "Medium" : "Low"}`}
        </p>
      </div>
    );
  }
  return null;
};

export function MemberWorkloadChart({ data }: MemberWorkloadChartProps) {
  // Sort data by active tasks (descending) and filter out inactive members
  const sortedData = [...data]
    .sort((a, b) => b.activeTasks - a.activeTasks)
    .filter((item) => item.activeTasks > 0 || item.reportedTasks > 0);

  // Prepare data for stacked area chart
  const chartData = sortedData.map((item) => {
    const workloadLevel = item.activeTasks > 10 ? "high" : item.activeTasks > 5 ? "medium" : "low";

    return {
      memberName: item.memberName,
      activeTasks: item.activeTasks,
      reportedTasks: item.reportedTasks,
      workload: workloadLevel,
      fill: chartConfig[workloadLevel].color,
    };
  });

  return (
    <ChartWrapper
      title="Member Workload Distribution"
      description="Active tasks vs reported tasks by member"
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="memberName"
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="colorReported" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="activeTasks"
            name="Assigned Tasks"
            stroke="#3B82F6"
            fillOpacity={1}
            fill="url(#colorAssigned)"
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="reportedTasks"
            name="Reported Tasks"
            stroke="#8B5CF6"
            fillOpacity={1}
            fill="url(#colorReported)"
            stackId="1"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
