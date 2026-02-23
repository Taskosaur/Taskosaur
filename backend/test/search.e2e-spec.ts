import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility, TaskPriority, TaskType } from '@prisma/client';
import { GlobalSearchDto, AdvancedSearchDto } from './../src/modules/search/dto/search.dto';

describe('SearchController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let otherUser: any;
  let accessToken: string;
  let otherAccessToken: string;
  let organizationId: string;
  let otherOrganizationId: string;
  let workspaceId: string;
  let projectId: string;
  let otherProjectId: string;
  let workflowId: string;
  let statusId: string;
  let taskId: string;
  let otherTaskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create a primary test user
    user = await prismaService.user.create({
      data: {
        email: `search-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Search',
        lastName: 'Tester',
        username: `search_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token for primary user
    accessToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    // Create another test user for cross-tenant testing
    otherUser = await prismaService.user.create({
      data: {
        email: `other-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Other',
        lastName: 'Tester',
        username: `other_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token for other user
    otherAccessToken = jwtService.sign({ sub: otherUser.id, email: otherUser.email, role: otherUser.role });

    // Create Organization for primary user
    const organization = await prismaService.organization.create({
      data: {
        name: `Search Org ${Date.now()}`,
        slug: `search-org-${Date.now()}`,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: Role.OWNER,
          },
        },
      },
    });
    organizationId = organization.id;

    // Create Organization for other user
    const otherOrganization = await prismaService.organization.create({
      data: {
        name: `Other Org ${Date.now()}`,
        slug: `other-org-${Date.now()}`,
        ownerId: otherUser.id,
        members: {
          create: {
            userId: otherUser.id,
            role: Role.OWNER,
          },
        },
      },
    });
    otherOrganizationId = otherOrganization.id;

    // Create Workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: 'Search Workflow',
        organizationId: organization.id,
        isDefault: true,
      },
    });
    workflowId = workflow.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Search Workspace ${Date.now()}`,
        slug: `search-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Project for primary user
    const project = await prismaService.project.create({
      data: {
        name: 'Search Project',
        slug: `search-project-${Date.now()}`,
        workspaceId: workspace.id,
        status: ProjectStatus.ACTIVE,
        priority: ProjectPriority.HIGH,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: user.id,
        workflowId: workflow.id,
        color: '#0000ff',
        members: {
          create: {
            userId: user.id,
            role: Role.OWNER,
          },
        },
      },
    });
    projectId = project.id;

    // Create Workspace for other user
    const otherWorkspace = await prismaService.workspace.create({
      data: {
        name: `Other Workspace ${Date.now()}`,
        slug: `other-workspace-${Date.now()}`,
        organizationId: otherOrganization.id,
        members: {
          create: {
            userId: otherUser.id,
            role: Role.OWNER,
          },
        },
      },
    });

    // Create Project for other user
    const otherProject = await prismaService.project.create({
      data: {
        name: 'Other Project',
        slug: `other-project-${Date.now()}`,
        workspaceId: otherWorkspace.id,
        status: ProjectStatus.ACTIVE,
        priority: ProjectPriority.HIGH,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: otherUser.id,
        workflowId: workflowId, // Re-use same workflow for simplicity
        color: '#ff0000',
        members: {
          create: {
            userId: otherUser.id,
            role: Role.OWNER,
          },
        },
      },
    });
    otherProjectId = otherProject.id;

    // Create Status
    const status = await prismaService.taskStatus.create({
      data: {
        name: 'In Progress',
        color: '#ff0000',
        position: 1,
        workflowId: workflow.id,
        category: 'IN_PROGRESS',
      },
    });
    statusId = status.id;

    // Create searchable tasks for primary user
    const task1 = await prismaService.task.create({
      data: {
        title: 'Authentication Bug Fix',
        description: 'Fix authentication issue in login module',
        projectId: project.id,
        statusId: status.id,
        createdBy: user.id,
        priority: TaskPriority.HIGH,
        type: TaskType.BUG,
        taskNumber: 1,
        slug: `auth-bug-fix-${Date.now()}`,
      },
    });
    taskId = task1.id;

    await prismaService.task.create({
      data: {
        title: 'User Profile Feature',
        description: 'Implement user profile page with avatar upload',
        projectId: project.id,
        statusId: status.id,
        createdBy: user.id,
        priority: TaskPriority.MEDIUM,
        type: TaskType.STORY,
        taskNumber: 2,
        slug: `user-profile-${Date.now()}`,
      },
    });

    // Create a task for the other user (should NOT be visible to primary user)
    const taskOther = await prismaService.task.create({
      data: {
        title: 'Other User Private Task',
        description: 'Secret information for other user only',
        projectId: otherProject.id,
        statusId: status.id,
        createdBy: otherUser.id,
        priority: TaskPriority.HIGHEST,
        type: TaskType.BUG,
        taskNumber: 1,
        slug: `other-task-${Date.now()}`,
      },
    });
    otherTaskId = taskOther.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup all test data
      await prismaService.task.deleteMany({ where: { id: { in: [taskId, otherTaskId] } } });
      await prismaService.task.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
      await prismaService.projectMember.deleteMany({ where: { userId: { in: [user.id, otherUser.id] } } });
      await prismaService.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
      await prismaService.workspace.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organizationMember.deleteMany({ where: { userId: { in: [user.id, otherUser.id] } } });
      await prismaService.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
      await prismaService.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } });
    }
    await app.close();
  });

  describe('/search/global (POST)', () => {
    it('should perform global search within authorized scope', () => {
      const searchDto: GlobalSearchDto = {
        query: 'authentication',
        organizationId: organizationId,
      };

      return request(app.getHttpServer())
        .post('/api/search/global')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results[0].title).toContain('Authentication');
        });
    });

    it('should NOT return results from another organization (cross-tenant check)', async () => {
      const searchDto: GlobalSearchDto = {
        query: 'Private Task', // This query matches otherUser's task
      };

      const response = await request(app.getHttpServer())
        .post('/api/search/global')
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as primary user
        .send(searchDto)
        .expect(HttpStatus.OK);

      // Primary user should not see otherUser's task even without explicit scope
      const otherTaskFound = response.body.results.some((r: any) => r.id === otherTaskId);
      expect(otherTaskFound).toBe(false);
      expect(response.body.total).toBe(0);
    });

    it('should return no results when explicitly providing unauthorized organizationId', async () => {
      const searchDto: GlobalSearchDto = {
        query: 'authentication',
        organizationId: otherOrganizationId, // Explicitly target other user's org
      };

      const response = await request(app.getHttpServer())
        .post('/api/search/global')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK);

      expect(response.body.results.length).toBe(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('/search/advanced (POST)', () => {
    it('should perform advanced search with filters', () => {
      const searchDto: AdvancedSearchDto = {
        query: 'bug',
        taskTypes: [TaskType.BUG],
        priorities: [TaskPriority.HIGH],
        organizationId: organizationId,
      };

      return request(app.getHttpServer())
        .post('/api/search/advanced')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body.total).toBeGreaterThan(0);
        });
    });

    it('should NOT return tasks from other user in advanced search', async () => {
      const searchDto: AdvancedSearchDto = {
        query: 'Private Task',
      };

      const response = await request(app.getHttpServer())
        .post('/api/search/advanced')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK);

      expect(response.body.total).toBe(0);
    });
  });

  describe('/search/quick (GET)', () => {
    it('should perform quick search and respect user scope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/quick')
        .query({ q: 'Private Task' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.total).toBe(0);
    });

    it('should return results for other user when they search for their task', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/quick')
        .query({ q: 'Private Task' })
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.results[0].id).toBe(otherTaskId);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/search/global')
        .send({ query: 'test' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
