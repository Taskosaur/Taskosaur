import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GlobalSearchDto,
  AdvancedSearchDto,
  SearchEntityType,
  SortBy,
  SortOrder,
} from './dto/search.dto';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  projectId?: string;
  projectKey?: string;
  organizationId?: string;
  workspaceId?: string;
  relevanceScore: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: any;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTime: number;
}

interface AccessibleScopes {
  organizationIds: string[];
  workspaceIds: string[];
  projectIds: string[];
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  private async getUserAccessibleScopeIds(userId: string): Promise<AccessibleScopes> {
    const userMemberships = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationMembers: { select: { organizationId: true } },
        workspaceMembers: { select: { workspaceId: true } },
        projectMembers: { select: { projectId: true } },
      },
    });

    return {
      organizationIds: userMemberships?.organizationMembers.map((om) => om.organizationId) || [],
      workspaceIds: userMemberships?.workspaceMembers.map((wm) => wm.workspaceId) || [],
      projectIds: userMemberships?.projectMembers.map((pm) => pm.projectId) || [],
    };
  }

  async globalSearch(searchDto: GlobalSearchDto, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const { query, entityType = SearchEntityType.ALL, page = 1, limit = 20 } = searchDto;
    const offset = (page - 1) * limit;

    const accessibleScopes = await this.getUserAccessibleScopeIds(userId);
    if (
      accessibleScopes.organizationIds.length === 0 &&
      accessibleScopes.workspaceIds.length === 0 &&
      accessibleScopes.projectIds.length === 0
    ) {
      return { results: [], total: 0, page, limit, totalPages: 0, searchTime: 0 };
    }

    const searchPromises: Promise<SearchResult[]>[] = [];

    // Search based on entity type
    if (entityType === SearchEntityType.ALL || entityType === SearchEntityType.TASKS) {
      searchPromises.push(this.searchTasks(query, searchDto, offset, limit, accessibleScopes));
    }

    if (entityType === SearchEntityType.ALL || entityType === SearchEntityType.PROJECTS) {
      searchPromises.push(this.searchProjects(query, searchDto, offset, limit, accessibleScopes));
    }

    if (entityType === SearchEntityType.ALL || entityType === SearchEntityType.USERS) {
      searchPromises.push(this.searchUsers(query, searchDto, offset, limit, accessibleScopes));
    }

    if (entityType === SearchEntityType.ALL || entityType === SearchEntityType.COMMENTS) {
      searchPromises.push(this.searchComments(query, searchDto, offset, limit, accessibleScopes));
    }

    if (entityType === SearchEntityType.ALL || entityType === SearchEntityType.ATTACHMENTS) {
      searchPromises.push(
        this.searchAttachments(query, searchDto, offset, limit, accessibleScopes),
      );
    }

    if (entityType === SearchEntityType.ALL || entityType === SearchEntityType.SPRINTS) {
      searchPromises.push(this.searchSprints(query, searchDto, offset, limit, accessibleScopes));
    }

    let results = (await Promise.all(searchPromises)).flat();

    // Sort results by relevance score or specified criteria
    results = this.sortResults(results, searchDto.sortBy, searchDto.sortOrder);

    const total = results.length;
    // Apply pagination for global search
    if (entityType === SearchEntityType.ALL) {
      results = results.slice(offset, offset + limit);
    }

    const searchTime = Date.now() - startTime;

    return {
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchTime,
    };
  }

  async advancedSearch(searchDto: AdvancedSearchDto, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const { page = 1, limit = 20 } = searchDto;
    const offset = (page - 1) * limit;

    const accessibleScopes = await this.getUserAccessibleScopeIds(userId);
    if (
      accessibleScopes.organizationIds.length === 0 &&
      accessibleScopes.workspaceIds.length === 0 &&
      accessibleScopes.projectIds.length === 0
    ) {
      return { results: [], total: 0, page, limit, totalPages: 0, searchTime: 0 };
    }

    const where: any = {};
    this.addScopeFilters(where, searchDto, accessibleScopes, 'Task');

    if (where.impossibleToMatch) {
      return { results: [], total: 0, page, limit, totalPages: 0, searchTime: 0 };
    }

    // Add text search
    if (searchDto.query) {
      where.OR = [
        { title: { contains: searchDto.query, mode: 'insensitive' } },
        { description: { contains: searchDto.query, mode: 'insensitive' } },
        { slug: { contains: searchDto.query, mode: 'insensitive' } },
      ];
    }

    // Add filters
    if (searchDto.taskTypes?.length) {
      where.type = { in: searchDto.taskTypes };
    }

    if (searchDto.priorities?.length) {
      where.priority = { in: searchDto.priorities };
    }

    if (searchDto.assigneeIds?.length) {
      where.assignees = { some: { id: { in: searchDto.assigneeIds } } };
    }

    if (searchDto.reporterIds?.length) {
      where.reporters = { some: { id: { in: searchDto.reporterIds } } };
    }

    if (searchDto.statusIds?.length) {
      where.statusId = { in: searchDto.statusIds };
    }

    if (searchDto.labelIds?.length) {
      where.labels = {
        some: {
          labelId: { in: searchDto.labelIds },
        },
      };
    }

    if (searchDto.sprintIds?.length) {
      where.sprintId = { in: searchDto.sprintIds };
    }

    // Date filters
    if (searchDto.dueDateFrom || searchDto.dueDateTo) {
      where.dueDate = {};
      if (searchDto.dueDateFrom) {
        where.dueDate.gte = new Date(searchDto.dueDateFrom);
      }
      if (searchDto.dueDateTo) {
        where.dueDate.lte = new Date(searchDto.dueDateTo);
      }
    }

    if (searchDto.createdFrom || searchDto.createdTo) {
      where.createdAt = {};
      if (searchDto.createdFrom) {
        where.createdAt.gte = new Date(searchDto.createdFrom);
      }
      if (searchDto.createdTo) {
        where.createdAt.lte = new Date(searchDto.createdTo);
      }
    }

    // Build order clause
    const orderBy = this.buildOrderBy(searchDto.sortBy, searchDto.sortOrder);

    // Execute search
    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              slug: true,
              name: true,
              workspaceId: true,
              workspace: { select: { id: true, organizationId: true } },
            },
          },
          assignees: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          reporters: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          status: {
            select: { id: true, name: true, color: true },
          },
          labels: {
            include: { label: true },
          },
          sprint: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    const results: SearchResult[] = tasks.map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      description: task.description || '',
      projectId: task.projectId,
      projectKey: task.project.slug,
      organizationId: task.project.workspace.organizationId,
      workspaceId: task.project.workspaceId,
      relevanceScore: this.calculateRelevanceScore(
        task.title,
        task.description || '',
        searchDto.query || '',
      ),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      metadata: {
        key: task.slug,
        type: task.type,
        priority: task.priority,
        assignee: task.assignees,
        reporter: task.reporters,
        status: task.status,
        labels: task.labels.map((tl) => tl.label),
        sprint: task.sprint,
        dueDate: task.dueDate,
        storyPoints: task.storyPoints,
      },
    }));

    const searchTime = Date.now() - startTime;

    return {
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchTime,
    };
  }

  private async searchTasks(
    query: string,
    searchDto: GlobalSearchDto,
    offset: number,
    limit: number,
    accessibleScopes: AccessibleScopes,
  ): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
      ],
    };

    this.addScopeFilters(where, searchDto, accessibleScopes, 'Task');
    if (where.impossibleToMatch) return [];

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            slug: true,
            workspaceId: true,
            workspace: { select: { organizationId: true } },
          },
        },
      },
      take: limit,
    });

    return tasks.map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      description: task.description || '',
      projectId: task.projectId,
      projectKey: task.project.slug,
      organizationId: task.project.workspace.organizationId,
      workspaceId: task.project.workspaceId,
      relevanceScore: this.calculateRelevanceScore(task.title, task.description || '', query),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      metadata: {
        key: task.slug,
        type: task.type,
        priority: task.priority,
      },
    }));
  }

  private async searchProjects(
    query: string,
    searchDto: GlobalSearchDto,
    offset: number,
    limit: number,
    accessibleScopes: AccessibleScopes,
  ): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
      ],
    };

    this.addScopeFilters(where, searchDto, accessibleScopes, 'Project');
    if (where.impossibleToMatch) return [];

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        workspace: { select: { id: true, organizationId: true } },
      },
      take: limit,
    });

    return projects.map((project) => ({
      id: project.id,
      type: 'project',
      title: project.name,
      description: project.description || '',
      projectId: project.id,
      projectKey: project.slug,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      relevanceScore: this.calculateRelevanceScore(project.name, project.description || '', query),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      metadata: {
        key: project.slug,
        status: project.status,
        priority: project.priority,
      },
    }));
  }

  private async searchUsers(
    query: string,
    searchDto: GlobalSearchDto,
    offset: number,
    limit: number,
    accessibleScopes: AccessibleScopes,
  ): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { username: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (searchDto.organizationId) {
      if (!accessibleScopes.organizationIds.includes(searchDto.organizationId)) {
        return [];
      }
      where.organizationMembers = {
        some: { organizationId: searchDto.organizationId },
      };
    } else {
      where.organizationMembers = {
        some: { organizationId: { in: accessibleScopes.organizationIds } },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      take: limit,
    });

    return users.map((user) => ({
      id: user.id,
      type: 'user',
      title: `${user.firstName} ${user.lastName}`,
      description: user.bio || user.email,
      relevanceScore: this.calculateRelevanceScore(
        `${user.firstName} ${user.lastName}`,
        user.email,
        query,
      ),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      metadata: {
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
      },
    }));
  }

  private async searchComments(
    query: string,
    searchDto: GlobalSearchDto,
    offset: number,
    limit: number,
    accessibleScopes: AccessibleScopes,
  ): Promise<SearchResult[]> {
    const where: any = {
      content: { contains: query, mode: 'insensitive' },
    };

    this.addScopeFilters(where, searchDto, accessibleScopes, 'TaskComment');
    if (where.impossibleToMatch) return [];

    const comments = await this.prisma.taskComment.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            projectId: true,
            project: {
              select: {
                slug: true,
                workspace: { select: { organizationId: true } },
              },
            },
          },
        },
        author: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      take: limit,
    });

    return comments.map((comment) => ({
      id: comment.id,
      type: 'comment',
      title: `Comment on ${comment.task.slug}: ${comment.task.title}`,
      description: comment.content.substring(0, 200),
      projectId: comment.task.projectId,
      projectKey: comment.task.project.slug,
      organizationId: comment.task.project.workspace.organizationId,
      relevanceScore: this.calculateRelevanceScore(comment.content, '', query),
      createdAt: comment.createdAt,
      updatedAt: comment.createdAt,
      metadata: {
        taskId: comment.taskId,
        taskKey: comment.task.slug,
        author: comment.author,
      },
    }));
  }

  private async searchAttachments(
    query: string,
    searchDto: GlobalSearchDto,
    offset: number,
    limit: number,
    accessibleScopes: AccessibleScopes,
  ): Promise<SearchResult[]> {
    const where: any = {
      fileName: { contains: query, mode: 'insensitive' },
    };

    this.addScopeFilters(where, searchDto, accessibleScopes, 'TaskAttachment');
    if (where.impossibleToMatch) return [];

    const attachments = await this.prisma.taskAttachment.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            projectId: true,
            project: {
              select: {
                slug: true,
                workspace: { select: { organizationId: true } },
              },
            },
          },
        },
      },
      take: limit,
    });

    return attachments.map((attachment) => ({
      id: attachment.id,
      type: 'attachment',
      title: attachment.fileName,
      description: `Attachment for ${attachment.task.slug}: ${attachment.task.title}`,
      projectId: attachment.task.projectId,
      projectKey: attachment.task.project.slug,
      organizationId: attachment.task.project.workspace.organizationId,
      relevanceScore: this.calculateRelevanceScore(attachment.fileName, '', query),
      createdAt: attachment.createdAt,
      updatedAt: attachment.createdAt,
      metadata: {
        taskId: attachment.taskId,
        taskKey: attachment.task.slug,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
      },
    }));
  }

  private async searchSprints(
    query: string,
    searchDto: GlobalSearchDto,
    offset: number,
    limit: number,
    accessibleScopes: AccessibleScopes,
  ): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { goal: { contains: query, mode: 'insensitive' } },
      ],
    };

    this.addScopeFilters(where, searchDto, accessibleScopes, 'Sprint');
    if (where.impossibleToMatch) return [];

    const sprints = await this.prisma.sprint.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            slug: true,
            workspaceId: true,
            workspace: { select: { id: true, organizationId: true } },
          },
        },
      },
      take: limit,
    });

    return sprints.map((sprint) => ({
      id: sprint.id,
      type: 'sprint',
      title: sprint.name,
      description: sprint.goal || '',
      projectId: sprint.projectId,
      projectKey: sprint.project.slug,
      organizationId: sprint.project.workspace.organizationId,
      workspaceId: sprint.project.workspaceId,
      relevanceScore: this.calculateRelevanceScore(sprint.name, sprint.goal || '', query),
      createdAt: sprint.createdAt,
      updatedAt: sprint.updatedAt,
      metadata: {
        status: sprint.status,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      },
    }));
  }

  private addScopeFilters(
    where: any,
    searchDto: GlobalSearchDto | AdvancedSearchDto,
    accessibleScopes: AccessibleScopes,
    modelName: 'Task' | 'Project' | 'TaskComment' | 'TaskAttachment' | 'Sprint',
  ) {
    const applyOrgFilter = (filter: any) => {
      switch (modelName) {
        case 'Task':
          where.project = { ...where.project, workspace: { organizationId: filter } };
          break;
        case 'Project':
          where.workspace = { organizationId: filter };
          break;
        case 'TaskComment':
        case 'TaskAttachment':
          where.task = { ...where.task, project: { workspace: { organizationId: filter } } };
          break;
        case 'Sprint':
          where.project = { ...where.project, workspace: { organizationId: filter } };
          break;
      }
    };

    if (searchDto.organizationId) {
      if (!accessibleScopes.organizationIds.includes(searchDto.organizationId)) {
        where.impossibleToMatch = true;
        return;
      }
      applyOrgFilter(searchDto.organizationId);
    } else {
      applyOrgFilter({ in: accessibleScopes.organizationIds });
    }

    const applyWorkspaceFilter = (filter: any) => {
      switch (modelName) {
        case 'Task':
          where.project = { ...where.project, workspaceId: filter };
          break;
        case 'Project':
          where.workspaceId = filter;
          break;
        case 'TaskComment':
        case 'TaskAttachment':
          where.task = { ...where.task, project: { workspaceId: filter } };
          break;
        case 'Sprint':
          where.project = { ...where.project, workspaceId: filter };
          break;
      }
    };

    if (searchDto.workspaceId) {
      if (!accessibleScopes.workspaceIds.includes(searchDto.workspaceId)) {
        where.impossibleToMatch = true;
        return;
      }
      applyWorkspaceFilter(searchDto.workspaceId);
    } else if (!searchDto.organizationId) {
      applyWorkspaceFilter({ in: accessibleScopes.workspaceIds });
    }

    const applyProjectFilter = (filter: any) => {
      switch (modelName) {
        case 'Task':
          where.projectId = filter;
          break;
        case 'Project':
          where.id = filter;
          break;
        case 'TaskComment':
        case 'TaskAttachment':
          where.task = { ...where.task, projectId: filter };
          break;
        case 'Sprint':
          where.projectId = filter;
          break;
      }
    };

    if (searchDto.projectId) {
      if (!accessibleScopes.projectIds.includes(searchDto.projectId)) {
        where.impossibleToMatch = true;
        return;
      }
      applyProjectFilter(searchDto.projectId);
    } else if (!searchDto.organizationId && !searchDto.workspaceId) {
      applyProjectFilter({ in: accessibleScopes.projectIds });
    }
  }

  private calculateRelevanceScore(title: string, description: string, query: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();
    const descLower = (description || '').toLowerCase();

    let score = 0;

    // Exact title match gets highest score
    if (titleLower === queryLower) score += 100;

    // Title contains query
    if (titleLower.includes(queryLower)) score += 50;

    // Description contains query
    if (descLower.includes(queryLower)) score += 25;

    // Word boundary matches get higher scores
    const titleWords = titleLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);

    for (const queryWord of queryWords) {
      if (titleWords.includes(queryWord)) score += 30;
    }

    return score;
  }

  private sortResults(
    results: SearchResult[],
    sortBy?: SortBy,
    sortOrder?: SortOrder,
  ): SearchResult[] {
    const order = sortOrder === SortOrder.ASC ? 1 : -1;

    return results.sort((a, b) => {
      switch (sortBy) {
        case SortBy.TITLE:
          return order * a.title.localeCompare(b.title);
        case SortBy.CREATED_AT:
          return order * (a.createdAt.getTime() - b.createdAt.getTime());
        case SortBy.UPDATED_AT:
          return order * (a.updatedAt.getTime() - b.updatedAt.getTime());
        case SortBy.RELEVANCE:
        default:
          return order * (b.relevanceScore - a.relevanceScore);
      }
    });
  }

  private buildOrderBy(sortBy?: SortBy, sortOrder?: SortOrder): any {
    const order = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case SortBy.TITLE:
        return { title: order };
      case SortBy.CREATED_AT:
        return { createdAt: order };
      case SortBy.UPDATED_AT:
        return { updatedAt: order };
      case SortBy.PRIORITY:
        return { priority: order };
      case SortBy.DUE_DATE:
        return { dueDate: order };
      default:
        return { updatedAt: order };
    }
  }

  async getSuggestions(query: string, limit: number = 10): Promise<string[]> {
    if (typeof query !== 'string' || query.length < 2) return [];

    // Get suggestions from task titles
    const taskTitles = await this.prisma.task.findMany({
      where: {
        title: { contains: query, mode: 'insensitive' },
      },
      select: { title: true },
      take: limit,
    });

    // Get suggestions from project names
    const projectNames = await this.prisma.project.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
      },
      select: { name: true },
      take: limit,
    });

    const suggestions = [...taskTitles.map((t) => t.title), ...projectNames.map((p) => p.name)];

    // Remove duplicates and return
    return [...new Set(suggestions)].slice(0, limit);
  }
}
