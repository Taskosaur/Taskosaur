// universal-search.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessControlService } from 'src/common/access-control.utils';

export enum SearchType {
  WORKSPACE = 'workspace',
  PROJECT = 'project',
  TASK = 'task',
  USER = 'user',
  COMMENT = 'comment',
  SPRINT = 'sprint',
  LABEL = 'label',
}

export interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  description?: string;
  url: string;
  context: {
    workspace?: { id: string; name: string };
    project?: { id: string; name: string; slug: string };
    parent?: { id: string; title: string; type: string };
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { id: string; name: string };
    status?: string;
    priority?: string;
    assignee?: { id: string; name: string };
    labels?: Array<{ id: string; name: string; color: string }>;
  };
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class UniversalSearchService {
  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
  ) {}

  async search(
    query: string,
    organizationId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<SearchResponse> {
    const { page = 1, limit = 20 } = options;

    // Validate organization access
    const { isElevated } = await this.validateOrganizationAccess(organizationId, userId);

    // Sanitize query
    const sanitizedQuery = this.sanitizeQuery(query);
    if (!sanitizedQuery || sanitizedQuery.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters long');
    }

    // Build search promises for different entity types
    const searchPromises = this.buildSearchPromises(
      sanitizedQuery,
      organizationId,
      userId,
      isElevated,
      limit,
    );

    // Execute all searches in parallel
    const searchResults = await Promise.all(searchPromises);

    // Flatten and score results
    const allResults = searchResults.flat();
    const scoredResults = this.scoreResults(allResults, sanitizedQuery);

    // Sort results by relevance
    const sortedResults = this.sortResults(scoredResults);

    // Paginate
    const skip = (page - 1) * limit;
    const paginatedResults = sortedResults.slice(skip, skip + limit);

    return {
      results: paginatedResults,
      total: sortedResults.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(sortedResults.length / limit),
      },
    };
  }

  private async validateOrganizationAccess(
    organizationId: string,
    userId: string,
  ): Promise<{ isElevated: boolean }> {
    try {
      const access = await this.accessControl.getOrgAccess(organizationId, userId);
      return { isElevated: access.isElevated };
    } catch (error) {
      console.error('Access denied to organization:', error);
      throw new ForbiddenException('Access denied to this organization');
    }
  }

  private sanitizeQuery(query: string): string {
    return query.trim().replace(/[<>]/g, '').replace(/['"]/g, '').substring(0, 100);
  }

  private buildSearchPromises(
    query: string,
    organizationId: string,
    userId: string,
    isElevated: boolean,
    limit: number,
  ): Promise<SearchResult[]>[] {
    const promises: Promise<SearchResult[]>[] = [];

    promises.push(this.searchWorkspaces(query, organizationId, userId, isElevated));
    promises.push(this.searchProjects(query, organizationId, userId, isElevated));
    promises.push(this.searchTasks(query, organizationId, userId, isElevated, limit * 2));
    promises.push(this.searchUsers(query, organizationId) as Promise<SearchResult[]>);
    // promises.push(this.searchComments(query, organizationId, userId, isElevated));
    promises.push(this.searchSprints(query, organizationId, userId, isElevated));
    // promises.push(this.searchLabels(query, organizationId, userId, isElevated));

    return promises;
  }

  private async searchWorkspaces(
    query: string,
    organizationId: string,
    userId: string,
    isElevated: boolean,
  ): Promise<SearchResult[]> {
    const whereClause: any = {
      organizationId,
      archive: false,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (!isElevated) {
      whereClause.members = { some: { userId } };
    }

    const workspaces = await this.prisma.workspace.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      take: 20,
    });

    return workspaces.map((workspace) => ({
      id: workspace.id,
      type: SearchType.WORKSPACE,
      title: workspace.name,
      description: workspace.description || undefined,
      url: `/workspaces/${workspace.slug}`,
      context: {
        workspace: { id: workspace.id, name: workspace.name },
      },
      metadata: {
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        createdBy: workspace.createdByUser
          ? {
              id: workspace.createdByUser.id,
              name: `${workspace.createdByUser.firstName} ${workspace.createdByUser.lastName}`,
            }
          : undefined,
      },
    }));
  }

  private async searchProjects(
    query: string,
    organizationId: string,
    userId: string,
    isElevated: boolean,
  ): Promise<SearchResult[]> {
    // Step 1: Build base search filters
    const baseFilters: any = {
      workspace: { organizationId },
      archive: false,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    let whereClause: any;

    if (isElevated) {
      // If elevated at org level, search all projects
      whereClause = baseFilters;
    } else {
      // If not elevated at org level, get accessible project IDs
      const accessibleProjectIds = await this.getAccessibleProjectIds(organizationId, userId);

      if (accessibleProjectIds.length === 0) {
        // No accessible projects, return empty result
        return [];
      }

      whereClause = {
        AND: [baseFilters, { id: { in: accessibleProjectIds } }],
      };
    }

    const projects = await this.prisma.project.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { id: true, name: true },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((project) => ({
      id: project.id,
      type: SearchType.PROJECT,
      title: project.name,
      description: project.description || undefined,
      url: `/projects/${project.slug}`,
      context: {
        workspace: project.workspace,
        project: { id: project.id, name: project.name, slug: project.slug },
      },
      metadata: {
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        status: project.status,
        priority: project.priority,
        createdBy: project.createdByUser
          ? {
              id: project.createdByUser.id,
              name: `${project.createdByUser.firstName} ${project.createdByUser.lastName}`,
            }
          : undefined,
      },
    }));
  }

  /**
   * Helper method to get accessible project IDs based on workspace-level permissions
   */
  private async getAccessibleProjectIds(organizationId: string, userId: string): Promise<string[]> {
    // Get all workspaces in the organization
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        organizationId,
        archive: false,
      },
      select: { id: true },
    });

    const accessibleProjectIds: string[] = [];

    // Check each workspace
    for (const workspace of workspaces) {
      try {
        // Get workspace-level access for this user
        const { isElevated: wsIsElevated } = await this.accessControl.getWorkspaceAccess(
          workspace.id,
          userId,
        );

        if (wsIsElevated) {
          // If elevated at workspace level, get all projects in this workspace
          const workspaceProjects = await this.prisma.project.findMany({
            where: {
              workspaceId: workspace.id,
              archive: false,
            },
            select: { id: true },
          });

          accessibleProjectIds.push(...workspaceProjects.map((p) => p.id));
        } else {
          // If not elevated at workspace level, get only projects where user is a member
          const memberProjects = await this.prisma.project.findMany({
            where: {
              workspaceId: workspace.id,
              archive: false,
              members: {
                some: { userId },
              },
            },
            select: { id: true },
          });

          accessibleProjectIds.push(...memberProjects.map((p) => p.id));
        }
      } catch (error) {
        console.error('Error accessing workspace:', error);
        // If user doesn't have access to workspace, skip it
        // This handles the ForbiddenException from getWorkspaceAccess
        continue;
      }
    }

    return [...new Set(accessibleProjectIds)]; // Remove duplicates
  }

  private async searchTasks(
    query: string,
    organizationId: string,
    userId: string,
    isElevated: boolean,
    limit: number,
  ): Promise<SearchResult[]> {
    // Step 1: Build base search filters
    const baseFilters: any = {
      project: {
        workspace: { organizationId },
      },
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    let whereClause: any;

    if (isElevated) {
      // If elevated at org level, search all tasks
      whereClause = baseFilters;
    } else {
      // If not elevated at org level, get accessible project IDs
      const accessibleProjectIds = await this.getAccessibleProjectIds(organizationId, userId);

      if (accessibleProjectIds.length === 0) {
        // No accessible projects, return empty result
        return [];
      }

      whereClause = {
        AND: [baseFilters, { projectId: { in: accessibleProjectIds } }],
      };
    }

    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        taskNumber: true,
        slug: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: { id: true, name: true },
            },
          },
        },
        status: {
          select: { name: true },
        },
        assignees: {
          select: { id: true, firstName: true, lastName: true },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        labels: {
          select: {
            label: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return tasks.map((task) => ({
      id: task.id,
      type: SearchType.TASK,
      title: `${task.project.name.toUpperCase()}-${task.taskNumber}: ${task.title}`,
      description: task.description || undefined,
      url: `/projects/${task.project.slug}/tasks/${task.slug}`,
      context: {
        workspace: task.project.workspace,
        project: {
          id: task.project.id,
          name: task.project.name,
          slug: task.project.slug,
        },
      },
      metadata: {
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        status: task.status.name,
        priority: task.priority,
        assignees: task.assignees
          ? task.assignees.map((assignee) => ({
              id: assignee.id,
              firstName: assignee.firstName,
              lastName: assignee.lastName,
            }))
          : undefined,
        createdBy: task.createdByUser
          ? {
              id: task.createdByUser.id,
              name: `${task.createdByUser.firstName} ${task.createdByUser.lastName}`,
            }
          : undefined,
        labels: task.labels.map((tl) => tl.label),
      },
    }));
  }

  private async searchUsers(query: string, organizationId: string): Promise<any[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationMembers: {
          some: { organizationId },
        },
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 15,
    });

    return users.map((user) => ({
      id: user.id,
      type: SearchType.USER,
      title: `${user.firstName} ${user.lastName}`,
      description: user.email,
      url: `/users/${user.id}`,
      context: {},
      metadata: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    }));
  }

  private async searchComments(
    query: string,
    organizationId: string,
    userId: string,
    isElevated: boolean,
  ): Promise<SearchResult[]> {
    const whereClause: any = {
      task: {
        project: {
          workspace: { organizationId },
        },
      },
      content: { contains: query, mode: 'insensitive' },
    };

    if (!isElevated) {
      whereClause.task.project.OR = [
        { members: { some: { userId } } },
        { workspace: { members: { some: { userId } } } },
      ];
    }

    const comments = await this.prisma.taskComment.findMany({
      where: whereClause,
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            taskNumber: true,
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                workspace: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return comments.map((comment) => ({
      id: comment.id,
      type: SearchType.COMMENT,
      title: `Comment on ${comment.task.project.name.toUpperCase()}-${comment.task.taskNumber}`,
      description: comment.content.substring(0, 150) + (comment.content.length > 150 ? '...' : ''),
      url: `/projects/${comment.task.project.slug}/tasks/${comment.task.slug}#comment-${comment.id}`,
      context: {
        workspace: comment.task.project.workspace,
        project: {
          id: comment.task.project.id,
          name: comment.task.project.name,
          slug: comment.task.project.slug,
        },
        parent: {
          id: comment.task.id,
          title: comment.task.title,
          type: 'task',
        },
      },
      metadata: {
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        createdBy: {
          id: comment.author.id,
          name: `${comment.author.firstName} ${comment.author.lastName}`,
        },
      },
    }));
  }

  private async searchSprints(
    query: string,
    organizationId: string,
    userId: string,
    isElevated: boolean,
  ): Promise<SearchResult[]> {
    const whereClause: any = {
      project: {
        workspace: { organizationId },
      },
      archive: false,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { goal: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (!isElevated) {
      whereClause.project.OR = [
        { members: { some: { userId } } },
        { workspace: { members: { some: { userId } } } },
      ];
    }

    const sprints = await this.prisma.sprint.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: { id: true, name: true },
            },
          },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      take: 15,
    });

    return sprints.map((sprint) => ({
      id: sprint.id,
      type: SearchType.SPRINT,
      title: sprint.name,
      description: sprint.goal || undefined,
      url: `/projects/${sprint.project.slug}/sprints/${sprint.id}`,
      context: {
        workspace: sprint.project.workspace,
        project: {
          id: sprint.project.id,
          name: sprint.project.name,
          slug: sprint.project.slug,
        },
      },
      metadata: {
        createdAt: sprint.createdAt,
        updatedAt: sprint.updatedAt,
        status: sprint.status,
        createdBy: sprint.createdByUser
          ? {
              id: sprint.createdByUser.id,
              name: `${sprint.createdByUser.firstName} ${sprint.createdByUser.lastName}`,
            }
          : undefined,
      },
    }));
  }

  private async searchLabels(
    query: string,
    organizationId: string,
    userId: string,
    isElevated: boolean,
  ): Promise<SearchResult[]> {
    const whereClause: any = {
      project: {
        workspace: { organizationId },
      },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (!isElevated) {
      whereClause.project.OR = [
        { members: { some: { userId } } },
        { workspace: { members: { some: { userId } } } },
      ];
    }

    const labels = await this.prisma.label.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: { id: true, name: true },
            },
          },
        },
      },
      take: 10,
    });

    return labels.map((label) => ({
      id: label.id,
      type: SearchType.LABEL,
      title: label.name,
      description: label.description || undefined,
      url: `/projects/${label.project.slug}/labels/${label.id}`,
      context: {
        workspace: label.project.workspace,
        project: {
          id: label.project.id,
          name: label.project.name,
          slug: label.project.slug,
        },
      },
      metadata: {
        createdAt: label.createdAt,
        updatedAt: label.updatedAt,
      },
    }));
  }

  private scoreResults(results: SearchResult[], query: string): SearchResult[] {
    const queryWords = query
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 1);

    return results.map((result) => {
      let score = 0;
      const title = result.title.toLowerCase();
      const description = (result.description || '').toLowerCase();

      // Exact title match gets highest score
      if (title === query.toLowerCase()) {
        score += 100;
      } else if (title.includes(query.toLowerCase())) {
        score += 50;
      }

      // Word matches in title
      queryWords.forEach((word) => {
        if (title.includes(word)) {
          score += 10;
        }
        if (description.includes(word)) {
          score += 5;
        }
      });

      // Boost score based on type priority (tasks are most important)
      switch (result.type) {
        case SearchType.TASK:
          score += 20;
          break;
        case SearchType.PROJECT:
          score += 15;
          break;
        case SearchType.WORKSPACE:
          score += 10;
          break;
        case SearchType.COMMENT:
          score += 8;
          break;
        default:
          score += 5;
      }

      // Recent items get slight boost
      const daysSinceUpdate =
        (Date.now() - result.metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        score += 5;
      } else if (daysSinceUpdate < 30) {
        score += 2;
      }

      return { ...result, score };
    });
  }

  private sortResults(results: SearchResult[]): SearchResult[] {
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}
