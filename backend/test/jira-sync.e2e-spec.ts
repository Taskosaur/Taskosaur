import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { JiraApiService } from '../src/modules/jira-sync/jira-api.service';

describe('JiraSyncController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let jiraApiService: JiraApiService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;

  const mockProject = {
    id: 'project-123',
    key: 'TEST',
    name: 'Test Project',
    description: 'Description',
    projectTypeKey: 'software',
    avatarUrls: { '48x48': 'http://jira.com/avatar.png' },
  };

  const mockStatus = {
    id: 'status-123',
    name: 'To Do',
    statusCategory: { id: 1, key: 'new', name: 'To Do' },
  };

  const mockIssue = {
    id: 'issue-123',
    key: 'TEST-1',
    fields: {
      summary: 'Task 1',
      description: 'Task Description',
      status: mockStatus,
      priority: { id: '3', name: 'Medium' },
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JiraApiService)
      .useValue({
        validateCredentials: jest.fn().mockResolvedValue(true),
        getProjects: jest.fn().mockResolvedValue([mockProject]),
        getProjectStatuses: jest.fn().mockResolvedValue([mockStatus]),
        getIssues: jest.fn().mockResolvedValue([mockIssue]),
        getIssuesBatch: jest.fn().mockImplementation(async function* () {
          yield [mockIssue];
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    jiraApiService = app.get<JiraApiService>(JiraApiService);

    // Create a test user
    user = await prismaService.user.create({
      data: {
        email: `jira-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Jira',
        lastName: 'Tester',
        username: `jira_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Jira Org ${Date.now()}`,
        slug: `jira-org-${Date.now()}`,
        ownerId: user.id,
      },
    });
    organizationId = organization.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Jira Workspace ${Date.now()}`,
        slug: `jira-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: `Jira Workflow ${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workflowId = workflow.id;

    // Create Task Status
    await prismaService.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#ff0000',
        position: 1,
        workflowId: workflowId,
        category: 'TODO',
      },
    });

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Jira Project',
        slug: `jira-project-${Date.now()}`,
        workspaceId: workspace.id,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: user.id,
        workflowId: workflow.id,
        color: '#000000',
      },
    });
    projectId = project.id;

    // Add user as Organization Member (OWNER)
    await prismaService.organizationMember.create({
      data: {
        organizationId: organizationId,
        userId: user.id,
        role: Role.OWNER,
      },
    });

    // Add user to workspace
    await prismaService.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspaceId,
        role: Role.OWNER,
      },
    });

    // Add user as Project Member (OWNER)
    await prismaService.projectMember.create({
      data: {
        projectId: projectId,
        userId: user.id,
        role: Role.OWNER,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.jiraSync.deleteMany({ where: { projectId } });
    await prismaService.projectMember.deleteMany({ where: { projectId } });
    await prismaService.task.deleteMany({ where: { projectId } });
    await prismaService.project.delete({ where: { id: projectId } });
    await prismaService.taskStatus.deleteMany({ where: { workflowId } });
    await prismaService.workflow.delete({ where: { id: workflowId } });
    await prismaService.workspaceMember.deleteMany({ where: { workspaceId } });
    await prismaService.workspace.delete({ where: { id: workspaceId } });
    await prismaService.organizationMember.deleteMany({ where: { organizationId } });
    await prismaService.organization.delete({ where: { id: organizationId } });
    await prismaService.user.delete({ where: { id: user.id } });
    await app.close();
  });

  describe('Pre-connection validation', () => {
    it('should validate credentials and list projects', () => {
      return request(app.getHttpServer())
        .post('/api/jira-sync/validate/projects')
        .send({
          jiraSiteUrl: 'https://test.atlassian.net',
          jiraEmail: 'test@example.com',
          jiraApiToken: 'token',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockProject.id);
        });
    });

    it('should validate credentials and list statuses', () => {
      return request(app.getHttpServer())
        .post('/api/jira-sync/validate/statuses')
        .send({
          jiraSiteUrl: 'https://test.atlassian.net',
          jiraProjectKey: 'TEST',
          jiraEmail: 'test@example.com',
          jiraApiToken: 'token',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockStatus.id);
        });
    });
  });

  describe('Connection and Management', () => {
    it('should connect a project to Jira', async () => {
      const status = await prismaService.taskStatus.findFirst({
        where: { workflowId },
      });
      const statusId = status!.id;

      const connectDto = {
        projectId,
        jiraSiteUrl: 'https://test.atlassian.net',
        jiraProjectKey: 'TEST',
        jiraEmail: 'test@example.com',
        jiraApiToken: 'token',
        syncInterval: 30,
        statusMappings: { 'status-123': statusId },
      };

      return request(app.getHttpServer())
        .post('/api/jira-sync/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(connectDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.projectId).toBe(projectId);
          expect(res.body.jiraProjectKey).toBe('TEST');
          expect(res.body.hasApiToken).toBe(true);
        });
    });

    it('should return 409 when connecting an already connected project', () => {
      const connectDto = {
        projectId,
        jiraSiteUrl: 'https://test.atlassian.net',
        jiraProjectKey: 'TEST',
        jiraEmail: 'test@example.com',
        jiraApiToken: 'token',
        statusMappings: {},
      };

      return request(app.getHttpServer())
        .post('/api/jira-sync/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(connectDto)
        .expect(HttpStatus.CONFLICT);
    });

    it('should get sync status for a project', () => {
      return request(app.getHttpServer())
        .get(`/api/jira-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.projectId).toBe(projectId);
          expect(res.body.jiraProjectKey).toBe('TEST');
        });
    });

    it('should update sync configuration', () => {
      const updateDto = {
        syncInterval: 60,
        syncEnabled: false,
      };

      return request(app.getHttpServer())
        .patch(`/api/jira-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.syncInterval).toBe(60);
          expect(res.body.syncEnabled).toBe(false);
        });
    });

    it('should list statuses using stored credentials', () => {
      return request(app.getHttpServer())
        .get(`/api/jira-sync/${projectId}/statuses`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockStatus.id);
        });
    });
  });

  describe('Sync execution', () => {
    it('should trigger a manual sync', () => {
      return request(app.getHttpServer())
        .post(`/api/jira-sync/${projectId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.issuesProcessed).toBeGreaterThan(0);
        });
    });

    it('should verify that sync created tasks in the database', async () => {
      const tasks = await prismaService.task.findMany({
        where: { projectId },
      });
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].jiraIssueId).toBe(mockIssue.id);
    });
  });

  describe('Disconnection', () => {
    it('should disconnect Jira sync', () => {
      return request(app.getHttpServer())
        .delete(`/api/jira-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toContain('successfully');
        });
    });

    it('should return 404 when getting status of disconnected project', () => {
      return request(app.getHttpServer())
        .get(`/api/jira-sync/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
