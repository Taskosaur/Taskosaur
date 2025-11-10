// components/charts/organization/quality-metrics-chart.tsx
import { PieChart, Pie, Cell } from "recharts";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartWrapper } from "../chart-wrapper";

const chartConfig = {
  resolved: { label: "Resolved", color: "#10B981" },
  low: { label: "Low Performance", color: "#EF4444" },
  medium: { label: "Medium Performance", color: "#F59E0B" },
  high: { label: "High Performance", color: "#10B981" },
  remaining: { label: "Remaining", color: "#E5E7EB" },
};

interface QualityMetricsChartProps {
  data: {
    totalBugs: number;
    resolvedBugs: number;
    criticalBugs: number;
    resolvedCriticalBugs: number;
    bugResolutionRate: number;
    criticalBugResolutionRate: number;
  };
}

export function QualityMetricsChart({ data }: QualityMetricsChartProps) {
  // Determine color based on resolution rate
  const getResolvedColor = (rate: number) => {
    if (rate > 80) return chartConfig.high.color;
    if (rate > 60) return chartConfig.medium.color;
    return chartConfig.low.color;
  };

  const gaugeData = [
    {
      name: chartConfig.resolved.label,
      value: data.bugResolutionRate,
      fill: getResolvedColor(data.bugResolutionRate),
    },
    {
      name: chartConfig.remaining.label,
      value: 100 - data.bugResolutionRate,
      fill: chartConfig.remaining.color,
    },
  ];

  return (
    <ChartWrapper
      title="Bug Resolution Quality"
      description={`${data.resolvedBugs}/${data.totalBugs} bugs resolved (${data.bugResolutionRate.toFixed(1)}%)`}
      config={chartConfig}
      className="border-[var(--border)]"
    >
      <div className="relative">
        <PieChart>
          <Pie
            data={gaugeData}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
          >
            {gaugeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent className="border-0 bg-[var(--accent)]" />} />
        </PieChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.bugResolutionRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Resolution Rate</div>
          </div>
        </div>
      </div>
    </ChartWrapper>
  );
}
