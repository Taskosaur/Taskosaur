import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { HiTrendingUp, HiTrendingDown } from "react-icons/hi";

interface StatCardProps {
  title: string;
  value: number | string | React.ReactNode;
  icon?: React.ReactNode;
  trend?: "up" | "down";
  trendValue?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendValue,
  className,
}) => {
  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xs font-medium text-secondary-500 dark:text-secondary-400 mb-1 uppercase tracking-wide">
              {title}
            </CardTitle>
            <CardDescription>
              <span className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                {value}
              </span>
            </CardDescription>
          </div>
          {icon && (
            <div className="p-1.5 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      {trend && trendValue && (
        <CardContent>
          <div
            className={`mt-2 text-xs flex items-center font-medium ${
              trend === "up"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {trend === "up" ? (
              <HiTrendingUp size={12} className="mr-1" />
            ) : (
              <HiTrendingDown size={12} className="mr-1" />
            )}
            {trendValue}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
