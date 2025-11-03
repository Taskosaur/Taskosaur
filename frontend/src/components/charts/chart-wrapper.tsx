// components/ui/chart-wrapper.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { ReactNode } from "react";

interface ChartWrapperProps {
  title: string;
  description?: string;
  children: ReactNode;
  config: ChartConfig;
  className?: string;
}

export function ChartWrapper({
  title,
  description,
  children,
  config,
  className = "analytics-chart-container",
}: ChartWrapperProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && (
          <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="min-h-[200px] w-full">
          {children as React.ReactElement}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
