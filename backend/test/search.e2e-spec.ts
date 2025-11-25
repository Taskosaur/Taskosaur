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
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let statusId: string;
  let taskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create a test user
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

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Search Org ${Date.now()}`,
        slug: `search-org-${Date.now()}`,
        ownerId: user.id,
      },
    });
    organizationId = organization.id;

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

    // Create Project
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
      },
    });
    projectId = project.id;

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

    // Create searchable tasks
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

    await prismaService.task.create({
      data: {
        title: 'API Documentation',
        description: 'Create comprehensive API documentation',
        projectId: project.id,
        statusId: status.id,
        createdBy: user.id,
        priority: TaskPriority.LOW,
        type: TaskType.TASK,
        taskNumber: 3,
        slug: `api-docs-${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.task.deleteMany({ where: { projectId } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/search/global (POST)', () => {
    it('should perform global search', () => {
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
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(Array.isArray(res.body.results)).toBe(true);
        });
    });

    it('should search with entity type filter', () => {
      const searchDto: GlobalSearchDto = {
        query: 'user',
        entityType: 'tasks' as any,
        organizationId: organizationId,
      };

      return request(app.getHttpServer())
        .post('/api/search/global')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(Array.isArray(res.body.results)).toBe(true);
        });
    });

    it('should search with workspace scope', () => {
      const searchDto: GlobalSearchDto = {
        query: 'profile',
        workspaceId: workspaceId,
      };

      return request(app.getHttpServer())
        .post('/api/search/global')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
    });

    it('should search with project scope', () => {
      const searchDto: GlobalSearchDto = {
        query: 'documentation',
        projectId: projectId,
      };

      return request(app.getHttpServer())
        .post('/api/search/global')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
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
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.results)).toBe(true);
        });
    });

    it('should filter by task type', () => {
      const searchDto: AdvancedSearchDto = {
        taskTypes: [TaskType.STORY],
        organizationId: organizationId,
      };

      return request(app.getHttpServer())
        .post('/api/search/advanced')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
    });

    it('should filter by priority', () => {
      const searchDto: AdvancedSearchDto = {
        priorities: [TaskPriority.HIGH, TaskPriority.MEDIUM],
        projectId: projectId,
      };

      return request(app.getHttpServer())
        .post('/api/search/advanced')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
    });

    it('should filter by status', () => {
      const searchDto: AdvancedSearchDto = {
        statusIds: [statusId],
        organizationId: organizationId,
      };

      return request(app.getHttpServer())
        .post('/api/search/advanced')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(searchDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
    });
  });

  describe('/search/suggestions (GET)', () => {
    it('should get search suggestions', () => {
      return request(app.getHttpServer())
        .get('/api/search/suggestions')
        .query({ q: 'auth' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should limit suggestions', () => {
      return request(app.getHttpServer())
        .get('/api/search/suggestions')
        .query({ q: 'user', limit: '5' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeLessThanOrEqual(5);
        });
    });
  });

  describe('/search/quick (GET)', () => {
    it('should perform quick search', () => {
      return request(app.getHttpServer())
        .get('/api/search/quick')
        .query({ q: 'authentication' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body).toHaveProperty('total');
        });
    });

    it('should quick search with type filter', () => {
      return request(app.getHttpServer())
        .get('/api/search/quick')
        .query({ q: 'profile', type: 'tasks' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
    });

    it('should quick search with pagination', () => {
      return request(app.getHttpServer())
        .get('/api/search/quick')
        .query({ q: 'task', page: '1', limit: '10' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(10);
        });
    });

    it('should quick search with organization scope', () => {
      return request(app.getHttpServer())
        .get('/api/search/quick')
        .query({ q: 'bug', organizationId: organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', () => {
      const searchDto: GlobalSearchDto = {
        query: 'test',
      };

      return request(app.getHttpServer())
        .post('/api/search/global')
        .send(searchDto)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
