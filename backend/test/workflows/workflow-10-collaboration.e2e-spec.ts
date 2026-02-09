import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility, TaskPriority, TaskType } from '@prisma/client';

/**
 * Workflow 10: Collaborative Task Discussion
 * 
 * This test covers team collaboration on tasks:
 * 1. User A creates task and assigns to User B
 * 2. User A adds initial comment
 * 3. User B views task and comments
 * 4. User B responds with comment
 * 5. User A updates comment
 * 6. User C joins as watcher
 * 7. User C contributes comment
 * 8. User A deletes outdated comment
 * 9. User B updates task status
 */
describe('Workflow 10: Collaborative Task Discussion (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prismaService: PrismaService;

  let userA: any;
  let userB: any;
  let userC: any;
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let statusId: string;
  let doneStatusId: string;
  let taskId: string;
  let commentAId: string;
  let commentBId: string;
  let commentCId: string;

  const password = 'SecurePassword123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.taskComment.deleteMany({ where: { taskId } });
      await prismaService.taskWatcher.deleteMany({ where: { taskId } });
      await prismaService.task.deleteMany({ where: { projectId } });
      if (statusId) await prismaService.taskStatus.delete({ where: { id: statusId } });
      if (doneStatusId) await prismaService.taskStatus.delete({ where: { id: doneStatusId } });
      if (projectId) await prismaService.project.delete({ where: { id: projectId } });
      if (workspaceId) await prismaService.workspace.delete({ where: { id: workspaceId } });
      if (workflowId) await prismaService.workflow.delete({ where: { id: workflowId } });
      if (organizationId) await prismaService.organization.delete({ where: { id: organizationId } });
      if (userA) await prismaService.user.delete({ where: { id: userA.id } });
      if (userB) await prismaService.user.delete({ where: { id: userB.id } });
      if (userC) await prismaService.user.delete({ where: { id: userC.id } });
    }
    await app.close();
  });

  describe('Collaborative Task Discussion', () => {
    it('Step 0: Setup environment via API', async () => {
      // Create user A (Owner)
      const regA = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `collab-a-${Date.now()}@example.com`,
          password,
          firstName: 'User',
          lastName: 'A',
          username: `user_a_${Date.now()}`,
          role: Role.OWNER,
        })
        .expect(HttpStatus.CREATED);
      userA = regA.body.user;
      tokenA = regA.body.access_token;

      // Create user B
      const regB = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `collab-b-${Date.now()}@example.com`,
          password,
          firstName: 'User',
          lastName: 'B',
          username: `user_b_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);
      userB = regB.body.user;
      tokenB = regB.body.access_token;

      // Create user C
      const regC = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `collab-c-${Date.now()}@example.com`,
          password,
          firstName: 'User',
          lastName: 'C',
          username: `user_c_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);
      userC = regC.body.user;
      tokenC = regC.body.access_token;

      // Create organization
      const orgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Collab Org',
          ownerId: userA.id,
        })
        .expect(HttpStatus.CREATED);
      organizationId = orgResponse.body.id;

      // Add B and C to organization
      await request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userB.id, organizationId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userC.id, organizationId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      // Create workflow
      const wfResponse = await request(app.getHttpServer())
        .post('/api/workflows')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Collab Workflow',
          organizationId: organizationId,
          isDefault: true,
        })
        .expect(HttpStatus.CREATED);
      workflowId = wfResponse.body.id;

      // Get default statuses
      const statusesResponse = await request(app.getHttpServer())
        .get(`/api/task-statuses?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.OK);
      
      statusId = statusesResponse.body.find((s: any) => s.name === 'In Progress').id;
      doneStatusId = statusesResponse.body.find((s: any) => s.name === 'Done').id;

      // Create workspace
      const wsResponse = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Collab Workspace',
          slug: `collab-ws-${Date.now()}`,
          organizationId: organizationId,
        })
        .expect(HttpStatus.CREATED);
      workspaceId = wsResponse.body.id;

      // Add B and C to workspace
      await request(app.getHttpServer())
        .post('/api/workspace-members')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userB.id, workspaceId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/workspace-members')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userC.id, workspaceId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      // Create project
      const projectResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Collaboration Project',
          slug: `collab-project-${Date.now()}`,
          workspaceId: workspaceId,
          workflowId: workflowId,
          color: '#9b59b6',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          visibility: ProjectVisibility.PRIVATE,
        })
        .expect(HttpStatus.CREATED);
      projectId = projectResponse.body.id;

      // Add B and C to project
      await request(app.getHttpServer())
        .post('/api/project-members')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userB.id, projectId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/project-members')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userC.id, projectId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);
    });

    it('Step 1: User A creates task and assigns to User B', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Implement Feature X',
          description: 'Need to implement the new feature',
          projectId: projectId,
          statusId: statusId,
          priority: TaskPriority.HIGH,
          type: TaskType.TASK,
          assigneeIds: [userB.id],
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      taskId = response.body.id;
    });

    it('Step 2: User A adds initial comment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          content: 'Please review the requirements document before starting',
          taskId: taskId,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      commentAId = response.body.id;
    });

    it('Step 3: User B views task', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(taskId);
      expect(response.body.title).toBe('Implement Feature X');
    });

    it('Step 4: User B views comments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/task-comments')
        .query({ taskId: taskId })
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      const comment = response.body.data.find((c: any) => c.id === commentAId);
      expect(comment).toBeDefined();
    });

    it('Step 5: User B responds with comment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          content: 'I have a question about the database schema',
          taskId: taskId,
        })
        .expect(HttpStatus.CREATED);

      commentBId = response.body.id;
    });

    it('Step 6: User A updates their comment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/task-comments/${commentAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          content: 'Please review the requirements document before starting. Also check the API specs.',
        })
        .expect(HttpStatus.OK);

      expect(response.body.content).toContain('API specs');
    });

    it('Step 7: User C joins as watcher', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-watchers/watch')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          taskId: taskId,
          userId: userC.id,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
    });

    it('Step 8: User C contributes comment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          content: 'I can help with the database design if needed',
          taskId: taskId,
        })
        .expect(HttpStatus.CREATED);

      commentCId = response.body.id;
    });

    it('Step 9: User A deletes outdated comment', async () => {
      await request(app.getHttpServer())
        .delete(`/api/task-comments/${commentAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('Step 10: User B marks task as complete', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          statusId: doneStatusId,
        })
        .expect(HttpStatus.OK);

      expect(response.body.statusId).toBe(doneStatusId);
    });

    it('Step 11: Verify all comments exist (except deleted)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/task-comments')
        .query({ taskId: taskId })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should have comments from B and C, but not A (deleted)
      const commentB = response.body.data.find((c: any) => c.id === commentBId);
      const commentC = response.body.data.find((c: any) => c.id === commentCId);
      expect(commentB).toBeDefined();
      expect(commentC).toBeDefined();
    });
  });
});
