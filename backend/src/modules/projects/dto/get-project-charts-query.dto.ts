// src/project/dto/get-project-charts-query.dto.ts
import { IsArray, IsEnum, ArrayNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ProjectChartType {
  TASK_STATUS = 'task-status',
  TASK_TYPE = 'task-type',
  KPI_METRICS = 'kpi-metrics',
  TASK_PRIORITY = 'task-priority',
  SPRINT_VELOCITY = 'sprint-velocity',
}
// src/project/interfaces/project-chart-data.interface.ts
export interface ProjectChartDataResponse {
  [key: string]: any;
}

export interface ProjectKPIMetrics {
  totalTasks: number;
  completedTasks: number;
  activeSprints: number;
  totalBugs: number;
  resolvedBugs: number;
  completionRate: number;
  bugResolutionRate: number;
}

export interface TaskStatusFlow {
  statusId: string;
  count: number;
  status: {
    id: string;
    name: string;
    color: string;
    category: string;
    position: number;
  };
}

export interface SprintVelocity {
  id: string;
  name: string;
  startDate: Date | null; // Allow null
  endDate: Date | null; // Allow null
  velocity: number;
}
export class GetProjectChartsQueryDto {
  @ApiProperty({
    description: 'Types of project chart data to retrieve',
    enum: ProjectChartType,
    isArray: true,
    example: [ProjectChartType.KPI_METRICS, ProjectChartType.TASK_STATUS],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one chart type must be specified' })
  @IsEnum(ProjectChartType, {
    each: true,
    message: 'Invalid chart type provided',
  })
  @Transform(({ value }): any => {
    if (Array.isArray(value)) {
      return value as any;
    }
    return typeof value === 'string' ? [value] : ([value] as any);
  })
  types: ProjectChartType[];
}
