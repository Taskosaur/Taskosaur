import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

/**
 * Workflow 1: New User Onboarding & First Project
 * 
 * This test covers the complete journey of a new user:
 * 1. Create user account
 * 2. Login and get JWT token
 * 3. View profile
 * 4. Create organization
 * 5. Create workspace
 * 6. Create project
 * 7. Create first task
 * 
 * Note: Registration and logout endpoints are not tested as they may not be implemented.
 * This workflow focuses on the core onboarding flow using pre-created users.
 */
describe('Workflow 1: New User Onboarding & First Project (e2e)', () => {
  jest.setTimeout(30000);
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
  });

  afterAll(async () => {
    if (prismaService && taskId) {
      // Cleanup in reverse order
      await prismaService.task.deleteMany({ where: { projectId } });
      if (statusId) await prismaService.taskStatus.delete({ where: { id: statusId } });
      if (projectId) await prismaService.project.delete({ where: { id: projectId } });
      if (workspaceId) await prismaService.workspace.delete({ where: { id: workspaceId } });
      if (workflowId) await prismaService.workflow.delete({ where: { id: workflowId } });
      if (organizationId) await prismaService.organization.delete({ where: { id: organizationId } });
      if (user) await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('Complete Onboarding Flow', () => {
    const password = 'SecurePassword123!';
    const email = `onboarding-${Date.now()}@example.com`;

    it('Step 1: Create new user account via registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password,
          firstName: 'New',
          lastName: 'User',
          username: `newuser_${Date.now()}`,
          role: Role.OWNER,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(email);
      user = response.body.user;
    });

    it('Step 2: Login and receive JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email,
          password,
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('access_token');
      accessToken = response.body.access_token;
    });

    it('Step 3: View user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('email', user.email);
    });

    it('Step 4: Create organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My First Organization',
          ownerId: user.id,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('My First Organization');
      expect(response.body).toHaveProperty('slug');
      organizationId = response.body.id;
    });

    it('Step 5: Create workspace within organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My First Workspace',
          slug: `workspace-${Date.now()}`,
          organizationId: organizationId,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('My First Workspace');
      expect(response.body.organizationId).toBe(organizationId);
      workspaceId = response.body.id;
    });

    it('Step 6: Create workflow and get default status', async () => {
      // Create workflow (this automatically creates default statuses)
      const workflowResponse = await request(app.getHttpServer())
        .post('/api/workflows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Default Workflow',
          organizationId: organizationId,
          isDefault: true,
        })
        .expect(HttpStatus.CREATED);
      
      workflowId = workflowResponse.body.id;

      // Fetch the created statuses to get the "To Do" status ID
      const statusesResponse = await request(app.getHttpServer())
        .get(`/api/task-statuses?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      
      const todoStatus = statusesResponse.body.find((s: any) => s.name === 'To Do');
      expect(todoStatus).toBeDefined();
      statusId = todoStatus.id;

      expect(workflowId).toBeDefined();
      expect(statusId).toBeDefined();
    });

    it('Step 7: Create project within workspace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My First Project',
          slug: `project-${Date.now()}`,
          workspaceId: workspaceId,
          workflowId: workflowId,
          color: '#3498db',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.MEDIUM,
          visibility: ProjectVisibility.PRIVATE,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('My First Project');
      expect(response.body.workspaceId).toBe(workspaceId);
      projectId = response.body.id;
    });

    it('Step 8: Create first task in project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'My First Task',
          description: 'This is my very first task in the system',
          projectId: projectId,
          statusId: statusId,
          priority: 'MEDIUM',
          type: 'TASK',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('My First Task');
      expect(response.body.projectId).toBe(projectId);
      expect(response.body.statusId).toBe(statusId);
      taskId = response.body.id;
    });

    it('Step 9: Verify complete setup', async () => {
      // Verify organization
      const org = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      expect(org.body.id).toBe(organizationId);

      // Verify workspace
      const workspace = await request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      expect(workspace.body.id).toBe(workspaceId);

      // Verify project
      const project = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      expect(project.body.id).toBe(projectId);

      // Verify task
      const task = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      expect(task.body.id).toBe(taskId);
    });
  });
});
