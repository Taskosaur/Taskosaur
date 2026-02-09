import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility, TaskPriority, TaskType } from '@prisma/client';

/**
 * Workflow 4: Multi-Workspace Project Management
 * 
 * This test covers working across multiple workspaces:
 * 1. List user's organizations
 * 2. Create multiple workspaces
 * 3. Create projects in each workspace
 * 4. List projects by workspace
 * 5. Create tasks across projects
 * 6. Verify task isolation by project
 */
describe('Workflow 4: Multi-Workspace Project Management (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let devWorkspaceId: string;
  let marketingWorkspaceId: string;
  let apiProjectId: string;
  let campaignProjectId: string;
  let workflowId: string;
  let statusId: string;
  let apiTaskId: string;
  let campaignTaskId: string;

  const password = 'SecurePassword123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.task.deleteMany({ where: { projectId: apiProjectId } });
      await prismaService.task.deleteMany({ where: { projectId: campaignProjectId } });
      if (apiProjectId) await prismaService.project.delete({ where: { id: apiProjectId } });
      if (campaignProjectId) await prismaService.project.delete({ where: { id: campaignProjectId } });
      if (devWorkspaceId) await prismaService.workspace.delete({ where: { id: devWorkspaceId } });
      if (marketingWorkspaceId) await prismaService.workspace.delete({ where: { id: marketingWorkspaceId } });
      if (statusId) await prismaService.taskStatus.delete({ where: { id: statusId } });
      if (workflowId) await prismaService.workflow.delete({ where: { id: workflowId } });
      if (organizationId) await prismaService.organization.delete({ where: { id: organizationId } });
      if (user) await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('Multi-Workspace Management', () => {
    it('Step 0: Setup environment via API', async () => {
      // Create user
      const email = `multiws-${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password,
          firstName: 'Multi',
          lastName: 'Workspace',
          username: `multiws_${Date.now()}`,
          role: Role.OWNER,
        })
        .expect(HttpStatus.CREATED);
      
      user = registerResponse.body.user;
      accessToken = registerResponse.body.access_token;

      // Create organization
      const orgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Multi-WS Org',
          ownerId: user.id,
        })
        .expect(HttpStatus.CREATED);
      organizationId = orgResponse.body.id;

      // Create workflow (automatically creates default statuses)
      const wfResponse = await request(app.getHttpServer())
        .post('/api/workflows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Multi-WS Workflow',
          organizationId: organizationId,
          isDefault: true,
        })
        .expect(HttpStatus.CREATED);
      workflowId = wfResponse.body.id;

      // Get default status
      const statusesResponse = await request(app.getHttpServer())
        .get(`/api/task-statuses?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      statusId = statusesResponse.body.find((s: any) => s.name === 'To Do').id;
    });

    it('Step 1: List user organizations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(response.body)).toBe(true);
      const org = response.body.find((o: any) => o.id === organizationId);
      expect(org).toBeDefined();
    });

    it('Step 2: Create Development workspace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Development',
          slug: `development-${Date.now()}`,
          organizationId: organizationId,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.name).toBe('Development');
      devWorkspaceId = response.body.id;
    });

    it('Step 3: Create Marketing workspace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Marketing',
          slug: `marketing-${Date.now()}`,
          organizationId: organizationId,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.name).toBe('Marketing');
      marketingWorkspaceId = response.body.id;
    });

    it('Step 4: Create API Development project in Development workspace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'API Development',
          slug: `api-dev-${Date.now()}`,
          workspaceId: devWorkspaceId,
          workflowId: workflowId,
          color: '#3498db',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          visibility: ProjectVisibility.PRIVATE,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.name).toBe('API Development');
      expect(response.body.workspaceId).toBe(devWorkspaceId);
      apiProjectId = response.body.id;
    });

    it('Step 5: Create Campaign Q1 project in Marketing workspace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Campaign Q1',
          slug: `campaign-q1-${Date.now()}`,
          workspaceId: marketingWorkspaceId,
          workflowId: workflowId,
          color: '#e74c3c',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.MEDIUM,
          visibility: ProjectVisibility.PRIVATE,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.name).toBe('Campaign Q1');
      expect(response.body.workspaceId).toBe(marketingWorkspaceId);
      campaignProjectId = response.body.id;
    });

    it('Step 6: List workspaces', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/workspaces')
        .query({ organizationId: organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('Step 7: Create task in API Development project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Implement REST API',
          description: 'Create RESTful API endpoints',
          projectId: apiProjectId,
          statusId: statusId,
          priority: TaskPriority.HIGH,
          type: TaskType.TASK,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.title).toBe('Implement REST API');
      apiTaskId = response.body.id;
    });

    it('Step 8: Create task in Campaign Q1 project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Design Marketing Materials',
          description: 'Create campaign graphics and copy',
          projectId: campaignProjectId,
          statusId: statusId,
          priority: TaskPriority.MEDIUM,
          type: TaskType.TASK,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.title).toBe('Design Marketing Materials');
      campaignTaskId = response.body.id;
    });

    it('Step 9: Verify task isolation - API project tasks', async () => {
      const apiTask = await prismaService.task.findUnique({
        where: { id: apiTaskId },
      });

      expect(apiTask).toBeDefined();
      expect(apiTask?.projectId).toBe(apiProjectId);
      expect(apiTask?.title).toBe('Implement REST API');
    });

    it('Step 10: Verify task isolation - Campaign project tasks', async () => {
      const campaignTask = await prismaService.task.findUnique({
        where: { id: campaignTaskId },
      });

      expect(campaignTask).toBeDefined();
      expect(campaignTask?.projectId).toBe(campaignProjectId);
      expect(campaignTask?.title).toBe('Design Marketing Materials');
    });

    it('Step 11: Verify projects are in correct workspaces', async () => {
      const apiProject = await prismaService.project.findUnique({
        where: { id: apiProjectId },
      });
      const campaignProject = await prismaService.project.findUnique({
        where: { id: campaignProjectId },
      });

      expect(apiProject?.workspaceId).toBe(devWorkspaceId);
      expect(campaignProject?.workspaceId).toBe(marketingWorkspaceId);
    });
  });
});
