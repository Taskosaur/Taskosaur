// src/workspace/dto/get-workspace-charts-query.dto.ts
import { IsArray, IsEnum, ArrayNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum WorkspaceChartType {
  PROJECT_STATUS = 'project-status',
  TASK_PRIORITY = 'task-priority',
  KPI_METRICS = 'kpi-metrics',
  TASK_TYPE = 'task-type',
  SPRINT_STATUS = 'sprint-status',
  MONTHLY_COMPLETION = 'monthly-completion',
}
export interface WorkspaceChartDataResponse {
  [key: string]: any;
}

export interface WorkspaceKPIMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  overdueTasks: number;
  completionRate: number;
}

export interface MonthlyTaskCompletion {
  month: string;
  count: number;
}
export class GetWorkspaceChartsQueryDto {
  @ApiProperty({
    description: 'Types of workspace chart data to retrieve',
    enum: WorkspaceChartType,
    isArray: true,
    example: [WorkspaceChartType.KPI_METRICS, WorkspaceChartType.PROJECT_STATUS],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one chart type must be specified' })
  @IsEnum(WorkspaceChartType, {
    each: true,
    message: 'Invalid chart type provided',
  })
  @Transform(({ value }): any => {
    if (Array.isArray(value)) {
      return value as any;
    }
    return typeof value === 'string' ? [value] : ([value] as any);
  })
  types: WorkspaceChartType[];
}
