// src/organization/dto/get-charts-query.dto.ts
import { IsArray, IsEnum, ArrayNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ChartType {
  KPI_METRICS = 'kpi-metrics',
  PROJECT_PORTFOLIO = 'project-portfolio',
  TEAM_UTILIZATION = 'team-utilization',
  TASK_DISTRIBUTION = 'task-distribution',
  TASK_TYPE = 'task-type',
  SPRINT_METRICS = 'sprint-metrics',
  QUALITY_METRICS = 'quality-metrics',
  WORKSPACE_PROJECT_COUNT = 'workspace-project-count',
  MEMBER_WORKLOAD = 'member-workload',
  RESOURCE_ALLOCATION = 'resource-allocation',
}
export interface ChartDataResponse {
  [key: string]: any;
}
export class GetChartsQueryDto {
  @ApiProperty({
    description: 'Types of chart data to retrieve',
    enum: ChartType,
    isArray: true,
    example: [ChartType.KPI_METRICS, ChartType.PROJECT_PORTFOLIO],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one chart type must be specified' })
  @IsEnum(ChartType, { each: true, message: 'Invalid chart type provided' })
  @Transform(({ value }): any => {
    if (Array.isArray(value)) {
      return value;
    }
    return typeof value === 'string' ? [value] : [value];
  })
  types: ChartType[];
}
