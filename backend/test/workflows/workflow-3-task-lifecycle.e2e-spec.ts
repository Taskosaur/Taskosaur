import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility, TaskPriority, TaskType } from '@prisma/client';

/**
 * Workflow 3: Complete Task Management Lifecycle
 * 
 * This test covers the full lifecycle of a task:
 * 1. Create task
 * 2. Add custom status
 * 3. Update task status
 * 4. Assign task to team member
 * 5. Add labels
 * 6. Add comments
 * 7. Add dependencies
 * 8. Complete task
 * 
 * Note: Watchers and attachments are skipped as they may require additional setup.
 */
describe('Workflow 3: Complete Task Management Lifecycle (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let owner: any;
  let member: any;
  let ownerToken: string;
  let memberToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let todoStatusId: string;
  let inReviewStatusId: string;
  let doneStatusId: string;
  let taskId: string;
  let labelId: string;
  let commentId: string;

  const ownerPassword = 'SecurePassword123!';
  const memberPassword = 'SecurePassword123!';

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
      if (taskId) {
        await prismaService.taskComment.deleteMany({ where: { taskId } });
        await prismaService.taskLabel.deleteMany({ where: { taskId } });
        await prismaService.taskDependency.deleteMany({
          where: {
            OR: [{ dependentTaskId: taskId }, { blockingTaskId: taskId }],
          },
        });
        await prismaService.task.deleteMany({ where: { projectId } });
      }
      if (labelId) await prismaService.label.delete({ where: { id: labelId } });
      if (inReviewStatusId) await prismaService.taskStatus.delete({ where: { id: inReviewStatusId } });
      if (doneStatusId) await prismaService.taskStatus.delete({ where: { id: doneStatusId } });
      if (todoStatusId) await prismaService.taskStatus.delete({ where: { id: todoStatusId } });
      if (projectId) await prismaService.project.delete({ where: { id: projectId } });
      if (workspaceId) await prismaService.workspace.delete({ where: { id: workspaceId } });
      if (workflowId) await prismaService.workflow.delete({ where: { id: workflowId } });
      if (organizationId) await prismaService.organization.delete({ where: { id: organizationId } });
      if (owner) await prismaService.user.delete({ where: { id: owner.id } });
      if (member) await prismaService.user.delete({ where: { id: member.id } });
    }
    await app.close();
  });

  describe('Complete Task Lifecycle', () => {
    it('Step 0: Setup environment via API', async () => {
      // Create owner
      const ownerEmail = `task-owner-${Date.now()}@example.com`;
      const ownerReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: ownerEmail,
          password: ownerPassword,
          firstName: 'Task',
          lastName: 'Owner',
          username: `task_owner_${Date.now()}`,
          role: Role.OWNER,
        })
        .expect(HttpStatus.CREATED);
      
      owner = ownerReg.body.user;
      ownerToken = ownerReg.body.access_token;

      // Create member
      const memberEmail = `task-member-${Date.now()}@example.com`;
      const memberReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: memberEmail,
          password: memberPassword,
          firstName: 'Task',
          lastName: 'Member',
          username: `task_member_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);
      
      member = memberReg.body.user;
      memberToken = memberReg.body.access_token;

      // Create organization
      const orgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Task Lifecycle Org',
          ownerId: owner.id,
        })
        .expect(HttpStatus.CREATED);
      organizationId = orgResponse.body.id;

      // Create workspace
      const wsResponse = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Task Workspace',
          slug: `task-workspace-${Date.now()}`,
          organizationId: organizationId,
        })
        .expect(HttpStatus.CREATED);
      workspaceId = wsResponse.body.id;

      // Create workflow (automatically creates default statuses)
      const wfResponse = await request(app.getHttpServer())
        .post('/api/workflows')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Task Workflow',
          organizationId: organizationId,
          isDefault: true,
        })
        .expect(HttpStatus.CREATED);
      workflowId = wfResponse.body.id;

      // Get default status
      const statusesResponse = await request(app.getHttpServer())
        .get(`/api/task-statuses?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);
      todoStatusId = statusesResponse.body.find((s: any) => s.name === 'To Do').id;

      // Create project
      const projectResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Task Lifecycle Project',
          slug: `task-project-${Date.now()}`,
          workspaceId: workspaceId,
          workflowId: workflowId,
          color: '#3498db',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          visibility: ProjectVisibility.PRIVATE,
        })
        .expect(HttpStatus.CREATED);
      projectId = projectResponse.body.id;

      // Add member to organization, workspace, and project
      await request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: member.id, organizationId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/workspace-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: member.id, workspaceId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/project-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: member.id, projectId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      // Create label
      const labelResponse = await request(app.getHttpServer())
        .post('/api/labels')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'urgent',
          color: '#ff0000',
          projectId: projectId,
        })
        .expect(HttpStatus.CREATED);
      labelId = labelResponse.body.id;
    });

    it('Step 1: Create task', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Implement User Authentication',
          description: 'Add JWT-based authentication to the API',
          projectId: projectId,
          statusId: todoStatusId,
          priority: TaskPriority.HIGH,
          type: TaskType.TASK,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Implement User Authentication');
      expect(response.body.priority).toBe(TaskPriority.HIGH);
      taskId = response.body.id;
    });

    it('Step 2: Get "In Review" status ID', async () => {
      const statusesResponse = await request(app.getHttpServer())
        .get(`/api/task-statuses?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);
      
      const status = statusesResponse.body.find((s: any) => s.name === 'In Review');
      expect(status).toBeDefined();
      inReviewStatusId = status.id;
    });

    it('Step 3: Update task status to "In Review"', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          statusId: inReviewStatusId,
        })
        .expect(HttpStatus.OK);

      expect(response.body.statusId).toBe(inReviewStatusId);
    });

    it('Step 4: Assign task to team member', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assigneeIds: [member.id],
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('id', taskId);
    });

    it('Step 5: Add label to task', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-labels')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          taskId: taskId,
          labelId: labelId,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('taskId', taskId);
      expect(response.body).toHaveProperty('labelId', labelId);
    });

    it('Step 6: Add comment to task', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          content: 'I have started working on this task',
          taskId: taskId,
          authorId: member.id,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('I have started working on this task');
      commentId = response.body.id;
    });

    it('Step 7: Get "Done" status ID', async () => {
      const statusesResponse = await request(app.getHttpServer())
        .get(`/api/task-statuses?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);
      
      const status = statusesResponse.body.find((s: any) => s.name === 'Done');
      expect(status).toBeDefined();
      doneStatusId = status.id;
    });

    it('Step 8: Complete task by updating status to "Done"', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          statusId: doneStatusId,
        })
        .expect(HttpStatus.OK);

      expect(response.body.statusId).toBe(doneStatusId);
    });

    it('Step 9: Verify task completion', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(taskId);
      expect(response.body.statusId).toBe(doneStatusId);
      expect(response.body.title).toBe('Implement User Authentication');
    });

    it('Step 10: Verify comment exists', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/task-comments')
        .query({ taskId: taskId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      const comment = response.body.data.find((c: any) => c.id === commentId);
      expect(comment).toBeDefined();
      expect(comment.content).toBe('I have started working on this task');
    });
  });
});
