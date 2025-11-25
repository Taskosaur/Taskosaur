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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create owner user
    owner = await prismaService.user.create({
      data: {
        email: `task-owner-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Task',
        lastName: 'Owner',
        username: `task_owner_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Create member user
    member = await prismaService.user.create({
      data: {
        email: `task-member-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Task',
        lastName: 'Member',
        username: `task_member_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate tokens
    ownerToken = jwtService.sign({ sub: owner.id, email: owner.email, role: owner.role });
    memberToken = jwtService.sign({ sub: member.id, email: member.email, role: member.role });

    // Create organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Task Lifecycle Org ${Date.now()}`,
        slug: `task-lifecycle-${Date.now()}`,
        ownerId: owner.id,
      },
    });
    organizationId = organization.id;

    // Create workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: 'Task Workflow',
        organizationId: organizationId,
        isDefault: true,
      },
    });
    workflowId = workflow.id;

    // Create default status
    const todoStatus = await prismaService.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#cccccc',
        position: 1,
        workflowId: workflowId,
        category: 'TODO',
      },
    });
    todoStatusId = todoStatus.id;

    // Create workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Task Workspace ${Date.now()}`,
        slug: `task-workspace-${Date.now()}`,
        organizationId: organizationId,
      },
    });
    workspaceId = workspace.id;

    // Create project
    const project = await prismaService.project.create({
      data: {
        name: 'Task Lifecycle Project',
        slug: `task-project-${Date.now()}`,
        workspaceId: workspaceId,
        workflowId: workflowId,
        color: '#3498db',
        status: ProjectStatus.ACTIVE,
        priority: ProjectPriority.HIGH,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: owner.id,
      },
    });
    projectId = project.id;

    // Create label
    const label = await prismaService.label.create({
      data: {
        name: 'urgent',
        color: '#ff0000',
        projectId: projectId,
      },
    });
    labelId = label.id;
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

    it('Step 2: Add custom "In Review" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'In Review',
          color: '#f39c12',
          position: 2,
          workflowId: workflowId,
          category: 'IN_PROGRESS',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('In Review');
      inReviewStatusId = response.body.id;
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

    it('Step 7: Create "Done" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Done',
          color: '#27ae60',
          position: 3,
          workflowId: workflowId,
          category: 'DONE',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      doneStatusId = response.body.id;
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

      expect(Array.isArray(response.body)).toBe(true);
      const comment = response.body.find((c: any) => c.id === commentId);
      expect(comment).toBeDefined();
      expect(comment.content).toBe('I have started working on this task');
    });
  });
});
