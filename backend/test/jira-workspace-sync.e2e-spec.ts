import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { JiraApiService } from '../src/modules/jira-sync/jira-api.service';

describe('JiraWorkspaceController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let jiraApiService: JiraApiService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
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
        email: `jira-workspace-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Jira',
        lastName: 'Workspace Tester',
        username: `jira_workspace_tester_${Date.now()}`,
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
        isDefault: true,
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
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.jiraSync.deleteMany({ where: { workspaceId } });
    await prismaService.project.deleteMany({ where: { workspaceId } });
    await prismaService.taskStatus.deleteMany({ where: { workflowId } });
    await prismaService.workflow.delete({ where: { id: workflowId } });
    await prismaService.workspaceMember.deleteMany({ where: { workspaceId } });
    await prismaService.workspace.delete({ where: { id: workspaceId } });
    await prismaService.organizationMember.deleteMany({ where: { organizationId } });
    await prismaService.organization.delete({ where: { id: organizationId } });
    await prismaService.user.delete({ where: { id: user.id } });
    await app.close();
  });

  describe('Workspace Connection', () => {
    it('should connect a workspace to Jira', () => {
      const connectDto = {
        jiraSiteUrl: 'https://test.atlassian.net',
        jiraEmail: 'test@example.com',
        jiraApiToken: 'token',
      };

      return request(app.getHttpServer())
        .post(`/api/workspaces/${workspaceId}/jira-sync/connect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(connectDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.workspaceId).toBe(workspaceId);
          expect(res.body.hasApiToken).toBe(true);
        });
    });

    it('should get sync status for a workspace', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/jira-sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.workspaceId).toBe(workspaceId);
          expect(res.body.hasApiToken).toBe(true);
        });
    });

    it('should list projects for the workspace connection', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/jira-sync/projects`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockProject.id);
        });
    });

    it('should list statuses for a specific Jira project', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/jira-sync/projects/TEST/statuses`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockStatus.id);
        });
    });
  });

  describe('Bulk Import', () => {
    it('should import selected Jira projects', async () => {
      const status = await prismaService.taskStatus.findFirst({
        where: { workflowId },
      });
      const statusId = status!.id;

      const importDto = {
        projects: [
          {
            key: 'TEST',
            statusMappings: { 'status-123': statusId },
          },
        ],
      };

      return request(app.getHttpServer())
        .post(`/api/workspaces/${workspaceId}/jira-sync/import`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(importDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.importedProjectsCount).toBe(1);
        });
    });

    it('should list synced projects', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}/jira-sync/synced-projects`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(1);
          expect(res.body[0].jiraProjectKey).toBe('TEST');
        });
    });

    it('should trigger sync for all projects in the workspace', () => {
      return request(app.getHttpServer())
        .post(`/api/workspaces/${workspaceId}/jira-sync/sync-all`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          if (res.body.total !== 1) console.log('sync-all res.body:', res.body);
          expect(res.body.total).toBe(1);
          expect(res.body.successCount).toBe(1);
        });
    });
  });

  describe('Update and Disconnect', () => {
    it('should update workspace sync credentials', () => {
      const updateDto = {
        jiraSiteUrl: 'https://test-updated.atlassian.net',
        jiraEmail: 'test-updated@example.com',
        jiraApiToken: 'new-token',
      };

      return request(app.getHttpServer())
        .patch(`/api/workspaces/${workspaceId}/jira-sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.hasApiToken).toBe(true);
        });
    });

    it('should disconnect Jira sync from the workspace', () => {
      return request(app.getHttpServer())
        .delete(`/api/workspaces/${workspaceId}/jira-sync`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toContain('successfully');
        });
    });
  });
});
