import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { GanttService, GanttData } from './gantt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Gantt Charts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('gantt')
export class GanttController {
  constructor(private readonly ganttService: GanttService) {}

  @Get('project/:projectId')
  @ApiOperation({
    summary: 'Get Gantt chart data for a project',
    description: 'Returns tasks, timeline, critical path, and milestones for project visualization',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Gantt chart data for the project',
    schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              start: { type: 'string', format: 'date-time', nullable: true },
              end: { type: 'string', format: 'date-time', nullable: true },
              progress: { type: 'number', minimum: 0, maximum: 100 },
              dependencies: { type: 'array', items: { type: 'string' } },
              assignee: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  avatar: { type: 'string', nullable: true },
                },
              },
              priority: { type: 'string' },
              status: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  color: { type: 'string' },
                },
              },
              type: { type: 'string' },
              key: { type: 'string' },
              parent: { type: 'string', nullable: true },
              children: {
                type: 'array',
                items: { $ref: '#/components/schemas/GanttTask' },
              },
            },
          },
        },
        timeline: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            duration: { type: 'number', description: 'Duration in days' },
          },
        },
        criticalPath: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Task IDs on the critical path',
        },
        milestones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              date: { type: 'string', format: 'date-time' },
              type: {
                type: 'string',
                enum: ['sprint_start', 'sprint_end', 'project_milestone'],
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  getProjectGanttData(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<GanttData> {
    return this.ganttService.getProjectGanttData(projectId);
  }

  @Get('sprint/:sprintId')
  @ApiOperation({
    summary: 'Get Gantt chart data for a sprint',
    description: 'Returns tasks and timeline for sprint visualization',
  })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Gantt chart data for the sprint',
    schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          description: 'Tasks in the sprint with Gantt chart properties',
        },
        timeline: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            duration: { type: 'number' },
          },
        },
        criticalPath: {
          type: 'array',
          items: { type: 'string' },
        },
        milestones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              date: { type: 'string', format: 'date-time' },
              type: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  getSprintGanttData(@Param('sprintId', ParseUUIDPipe) sprintId: string): Promise<GanttData> {
    return this.ganttService.getSprintGanttData(sprintId);
  }

  @Get('project/:projectId/resources')
  @ApiOperation({
    summary: 'Get resource allocation for project',
    description: 'Returns resource allocation and workload distribution for project planning',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Resource allocation data',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          assignee: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              avatar: { type: 'string', nullable: true },
            },
          },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                title: { type: 'string' },
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' },
                storyPoints: { type: 'number' },
              },
            },
          },
          workload: {
            type: 'number',
            description: 'Total workload (story points)',
          },
        },
      },
    },
  })
  getResourceAllocation(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.ganttService.getResourceAllocation(projectId);
  }
}
