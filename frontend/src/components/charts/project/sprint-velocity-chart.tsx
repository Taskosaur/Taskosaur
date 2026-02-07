// components/charts/project/sprint-velocity-chart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartWrapper } from "../chart-wrapper";
import { SprintVelocity } from "@/types/projects";

const chartConfig = {
  velocity: { label: "Story Points", color: "#3B82F6" },
  average: { label: "Average Velocity", color: "#94A3B8" },
};

interface SprintVelocityChartProps {
  data: SprintVelocity[];
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--accent)] border-0 p-3 rounded-lg shadow-md">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-blue-600">
          {`${chartConfig.velocity.label}: ${payload[0].value}`}
        </p>
        {payload[1] && (
          <p className="text-sm text-gray-500">
            {`${chartConfig.average.label}: ${payload[1].value}`}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Customized axis tick component
const CustomizedAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="end" fill="#666" transform="rotate(-35)" fontSize={12}>
        {payload.value}
      </text>
    </g>
  );
};

export function SprintVelocityChart({ data }: SprintVelocityChartProps) {
  const chartData = data?.map((sprint) => ({
    sprint: sprint.name,
    velocity: sprint.velocity || 0,
    date: sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : "N/A",
  }));

  // Calculate average velocity
  const averageVelocity =
    chartData?.length > 0
      ? chartData.reduce((sum, item) => sum + item.velocity, 0) / chartData.length
      : 0;

  // Add average to each data point for the line
  const chartDataWithAverage = chartData?.map((item) => ({
    ...item,
    average: Math.round(averageVelocity),
  }));

  return (
    <ChartWrapper
      title="Sprint Velocity Trend"
      description="Story points completed per sprint"
      config={chartConfig}
      className="border-[var(--border)]"
    >
      {chartDataWithAverage && chartDataWithAverage.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartDataWithAverage} margin={{ top: 5, right: 30, left: 20, bottom: 35 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="sprint" tick={<CustomizedAxisTick />} interval={0} height={60} />
            <YAxis
              label={{
                value: "Story Points",
                angle: -90,
                position: "insideLeft",
                offset: -10,
                style: { textAnchor: "middle" },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-gray-700">
                  {chartConfig[value as keyof typeof chartConfig]?.label || value}
                </span>
              )}
            />
            <Line
              type="monotone"
              dataKey="velocity"
              name="velocity"
              stroke={chartConfig.velocity.color}
              strokeWidth={3}
              dot={{ fill: chartConfig.velocity.color, strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, fill: chartConfig.velocity.color }}
            />
            <Line
              type="monotone"
              dataKey="average"
              name="average"
              stroke={chartConfig.average.color}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground italic">
          No completed sprints found for this project
        </div>
      )}
    </ChartWrapper>
  );
}
