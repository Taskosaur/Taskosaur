import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SearchService, SearchResponse } from './search.service';
import { GlobalSearchDto, AdvancedSearchDto } from './dto/search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Search')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('global')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Global search across all entities',
    description:
      'Search across tasks, projects, users, comments, attachments, and sprints with relevance scoring',
  })
  @ApiBody({ type: GlobalSearchDto })
  @ApiResponse({
    status: 200,
    description: 'Search results with relevance scoring and pagination',
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: {
                type: 'string',
                enum: ['task', 'project', 'user', 'comment', 'attachment', 'sprint'],
              },
              title: { type: 'string' },
              description: { type: 'string' },
              projectId: { type: 'string', format: 'uuid' },
              projectKey: { type: 'string' },
              organizationId: { type: 'string', format: 'uuid' },
              workspaceId: { type: 'string', format: 'uuid' },
              relevanceScore: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              metadata: { type: 'object' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
        searchTime: {
          type: 'number',
          description: 'Search time in milliseconds',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  globalSearch(@Body() globalSearchDto: GlobalSearchDto): Promise<SearchResponse> {
    return this.searchService.globalSearch(globalSearchDto);
  }

  @Post('advanced')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Advanced search with filters',
    description:
      'Advanced task search with detailed filters for type, priority, assignee, dates, etc.',
  })
  @ApiBody({ type: AdvancedSearchDto })
  @ApiResponse({
    status: 200,
    description: 'Filtered search results with detailed task information',
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: { type: 'string', example: 'task' },
              title: { type: 'string' },
              description: { type: 'string' },
              projectId: { type: 'string', format: 'uuid' },
              projectKey: { type: 'string' },
              organizationId: { type: 'string', format: 'uuid' },
              workspaceId: { type: 'string', format: 'uuid' },
              relevanceScore: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              metadata: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  type: { type: 'string' },
                  priority: { type: 'string' },
                  assignee: { type: 'object' },
                  reporter: { type: 'object' },
                  status: { type: 'object' },
                  labels: { type: 'array' },
                  sprint: { type: 'object' },
                  dueDate: { type: 'string', format: 'date-time' },
                  storyPoints: { type: 'number' },
                },
              },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
        searchTime: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search filters' })
  advancedSearch(@Body() advancedSearchDto: AdvancedSearchDto): Promise<SearchResponse> {
    return this.searchService.advancedSearch(advancedSearchDto);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Get search suggestions',
    description: 'Get autocomplete suggestions based on partial query',
  })
  @ApiQuery({
    name: 'q',
    description: 'Partial search query',
    example: 'auth',
    required: true,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of suggestions to return',
    example: 10,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'List of search suggestions',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: [
        'authentication bug fix',
        'auth middleware',
        'user authentication',
        'OAuth integration',
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameter' })
  getSuggestions(@Query('q') query: string, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.searchService.getSuggestions(query, limitNum);
  }

  @Get('quick')
  @ApiOperation({
    summary: 'Quick search with simple query string',
    description: 'Simple GET-based search for quick lookups',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'authentication bug',
    required: true,
  })
  @ApiQuery({
    name: 'type',
    description: 'Entity type to search',
    enum: ['all', 'tasks', 'projects', 'users', 'comments', 'attachments', 'sprints'],
    required: false,
  })
  @ApiQuery({
    name: 'organizationId',
    description: 'Organization scope',
    required: false,
  })
  @ApiQuery({
    name: 'workspaceId',
    description: 'Workspace scope',
    required: false,
  })
  @ApiQuery({
    name: 'projectId',
    description: 'Project scope',
    required: false,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    example: 1,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Results per page',
    example: 20,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Quick search results',
  })
  quickSearch(
    @Query('q') query: string,
    @Query('type') entityType?: string,
    @Query('organizationId') organizationId?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('projectId') projectId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<SearchResponse> {
    const searchDto: GlobalSearchDto = {
      query,
      entityType: entityType as any,
      organizationId,
      workspaceId,
      projectId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    return this.searchService.globalSearch(searchDto);
  }
}
