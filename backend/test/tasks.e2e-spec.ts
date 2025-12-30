import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { CreateTaskDto } from './../src/modules/tasks/dto/create-task.dto';

describe('TasksController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let user2: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let projectSlug: string;
  let statusId: string;
  let taskId: string;
  let sprintId: string;
  let parentTaskId: string;

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
        email: `task-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Task',
        lastName: 'Tester',
        username: `task_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Task Org ${Date.now()}`,
            slug: `task-org-${Date.now()}`,
            ownerId: user.id,
        }
    });
    organizationId = organization.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Task Workspace ${Date.now()}`,
        slug: `task-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

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
        workspaceId: workspace.id,
        role: Role.OWNER,
      },
    });

    // Create Workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: `Task Workflow ${Date.now()}`,
        organizationId: organization.id,
      },
    });

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Task Project',
        slug: `task-project-${Date.now()}`,
        workspaceId: workspace.id,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: user.id,
        workflowId: workflow.id,
        color: '#000000',
      },
    });
    projectSlug = project.slug;
    projectId = project.id;

    // Add user as Project Member (OWNER)
    await prismaService.projectMember.create({
      data: {
        projectId: projectId,
        userId: user.id,
        role: Role.OWNER,
      },
    });

    // Create a second test user
    user2 = await prismaService.user.create({
      data: {
        email: `task-test-2-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Task2',
        lastName: 'Tester2',
        username: `task_tester_2_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Add user2 to organization
    await prismaService.organizationMember.create({
      data: {
        organizationId: organizationId,
        userId: user2.id,
        role: Role.MEMBER,
      },
    });

    // Create Sprint
    const sprint = await prismaService.sprint.create({
      data: {
        name: 'Test Sprint',
        projectId: projectId,
        status: 'ACTIVE',
      },
    });
    sprintId = sprint.id;

    // Create Status
    const status = await prismaService.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#ff0000',
        position: 1,
        workflowId: workflow.id,
        category: 'TODO',
      },
    });
    statusId = status.id;

    // Create Parent Task
    const parentTask = await prismaService.task.create({
      data: {
        title: 'Parent Task',
        projectId: projectId,
        statusId: statusId,
        taskNumber: 1,
        slug: 'TASK-PR',
      },
    });
    parentTaskId = parentTask.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.task.deleteMany({ where: { projectId } });
      await prismaService.sprint.deleteMany({ where: { projectId } });
      await prismaService.taskStatus.deleteMany({ where: { workflow: { organizationId } } });
      await prismaService.project.deleteMany({ where: { id: projectId } });
      await prismaService.workspace.deleteMany({ where: { id: workspaceId } });
      await prismaService.organization.deleteMany({ where: { id: organizationId } });
      await prismaService.user.deleteMany({ where: { id: { in: [user.id, user2.id] } } });
    }
    await app.close();
  });

  describe('/tasks (POST)', () => {
    it('should create a task with basic fields', () => {
      const createDto: CreateTaskDto = {
        title: 'E2E Task',
        description: 'Task created by E2E test',
        projectId: projectId,
        statusId: statusId,
        priority: 'HIGH',
        type: 'TASK',
      };

      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe(createDto.title);
          taskId = res.body.id;
        });
    });

    it('should create a task with all fields', () => {
      const createDto: CreateTaskDto = {
        title: 'Full Task',
        description: 'Comprehensive task creation test',
        projectId: projectId,
        statusId: statusId,
        priority: 'HIGHEST',
        type: 'STORY',
        sprintId: sprintId,
        parentTaskId: parentTaskId,
        assigneeIds: [user.id, user2.id],
        reporterIds: [user.id],
        storyPoints: 5,
        originalEstimate: 120,
        remainingEstimate: 60,
        startDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      };

      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.title).toBe(createDto.title);
          expect(res.body.sprintId).toBe(sprintId);
          expect(res.body.parentTaskId).toBe(parentTaskId);
          expect(res.body.storyPoints).toBe(5);
          expect(res.body.assignees.length).toBe(2);
        });
    });
  });

  describe('/tasks (GET)', () => {
    it('should list tasks with organizationId', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should filter tasks by search query', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, search: 'E2E Task' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
          const hasE2ETask = res.body.data.some((t: any) => t.title === 'E2E Task');
          expect(hasE2ETask).toBe(true);
        });
    });

    it('should filter tasks by priorities', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, priorities: 'HIGHEST' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const allHighest = res.body.data.every((t: any) => t.priority === 'HIGHEST');
          expect(allHighest).toBe(true);
        });
    });

    it('should filter tasks by statusIds', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, statuses: statusId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const allMatchStatus = res.body.data.every((t: any) => t.statusId === statusId);
          expect(allMatchStatus).toBe(true);
        });
    });

    it('should filter tasks by assigneeIds', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, assigneeIds: user2.id })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const includesUser2 = res.body.data.every((t: any) => 
            t.assignees.some((a: any) => a.id === user2.id)
          );
          expect(includesUser2).toBe(true);
        });
    });

    it('should test pagination (limit)', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, limit: 1 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body).toHaveProperty('total');
          expect(res.body.limit).toBe(1);
        });
    });
  });

  describe('/tasks/all-tasks (GET)', () => {
    it('should get all tasks without pagination', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/all-tasks')
        .query({ organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });
  });

  describe('/tasks/by-status (GET)', () => {
    it('should get tasks grouped by status', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/by-status')
        .query({ slug: projectSlug })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/tasks/today (GET)', () => {
    it('should get today tasks', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/today')
        .query({ organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('tasks');
          expect(Array.isArray(res.body.tasks)).toBe(true);
        });
    });
  });

  describe('/api/tasks/organization/:orgId (GET)', () => {
    it('should get tasks by organization', () => {
      return request(app.getHttpServer())
        .get(`/api/tasks/organization/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('tasks');
          expect(Array.isArray(res.body.tasks)).toBe(true);
        });
    });
  });

  describe('/tasks/key/:key (GET)', () => {
    it('should get a task by its key', async () => {
      const task = await prismaService.task.findUnique({
        where: { id: taskId },
        select: { slug: true }
      });
      const key = task!.slug;

      return request(app.getHttpServer())
        .get(`/api/tasks/key/${key}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(taskId);
          expect(res.body.slug).toBe(key);
        });
    });
  });

  describe('/tasks/:id (GET)', () => {
    it('should get a task', () => {
      return request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(taskId);
          expect(res.body.title).toBe('E2E Task');
        });
    });
  });

  describe('/tasks/:id (PATCH)', () => {
    it('should update a task', () => {
      const updateDto = { title: 'Updated E2E Task' };
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.title).toBe(updateDto.title);
        });
    });
  });

  describe('/tasks/:id/status (PATCH)', () => {
    it('should update task status', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ statusId })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.statusId).toBe(statusId);
        });
    });
  });

  describe('/tasks/:id/assignees (PATCH)', () => {
    it('should update task assignees', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/assignees`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ assigneeIds: [user.id] })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.assignees.some((a: any) => a.id === user.id)).toBe(true);
        });
    });

    it('should fail to update assignees with invalid user IDs', () => {
      const invalidUserId = '00000000-0000-0000-0000-000000000000';
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/assignees`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ assigneeIds: [invalidUserId] })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('/tasks/:id/unassign (PATCH)', () => {
    it('should unassign all users from a task', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/unassign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.assignees.length).toBe(0);
        });
    });
  });

  describe('/tasks/:id/priority (PATCH)', () => {
    it('should update task priority', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/priority`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ priority: 'LOW' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.priority).toBe('LOW');
        });
    });
  });

  describe('/tasks/:id/due-date (PATCH)', () => {
    it("should update task's due date", () => {
      const dueDate = new Date().toISOString();
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/due-date`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ dueDate })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(new Date(res.body.dueDate).toISOString()).toBe(dueDate);
        });
    });
  });

  describe('/tasks/:id/comments (POST)', () => {
    it('should add a comment to a task', () => {
      return request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ comment: 'Test Shortcut Comment' })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.content).toBe('Test Shortcut Comment');
          expect(res.body.taskId).toBe(taskId);
        });
    });
  });

  describe('/tasks/create-task-attachment (POST)', () => {
    it('should create a task with attachments', () => {
      return request(app.getHttpServer())
        .post('/api/tasks/create-task-attachment')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('attachments', Buffer.from('test content'), 'test.txt')
        .field('title', 'Attachment Task')
        .field('projectId', projectId)
        .field('statusId', statusId)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.attachments.length).toBe(1);
          expect(res.body.attachments[0].fileName).toBe('test.txt');
        });
    });

    it('should fail when file exceeds size limit', () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      return request(app.getHttpServer())
        .post('/api/tasks/create-task-attachment')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('attachments', largeBuffer, 'large.pdf')
        .field('title', 'Large File Task')
        .field('projectId', projectId)
        .field('statusId', statusId)
        .expect(HttpStatus.PAYLOAD_TOO_LARGE);
    });

    it('should fail with disallowed file type', () => {
      return request(app.getHttpServer())
        .post('/api/tasks/create-task-attachment')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('attachments', Buffer.from('test'), 'malicious.exe')
        .field('title', 'Forbidden File Task')
        .field('projectId', projectId)
        .field('statusId', statusId)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((res) => {
          expect(res.body.message).toContain('not allowed');
        });
    });
  });

  describe('/tasks/bulk-delete (POST)', () => {
    it('should delete multiple tasks', async () => {
      const t1 = await prismaService.task.create({
        data: { title: 'Delete Me 1', projectId, statusId, taskNumber: 100, slug: `${projectSlug}-100` }
      });
      const t2 = await prismaService.task.create({
        data: { title: 'Delete Me 2', projectId, statusId, taskNumber: 101, slug: `${projectSlug}-101` }
      });

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ taskIds: [t1.id, t2.id], projectId })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.deletedCount).toBe(2);
        });
    });

    it('should fail with empty list of IDs and all=false', () => {
      return request(app.getHttpServer())
        .post('/api/tasks/bulk-delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ taskIds: [], projectId })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should report failed tasks when user lacks permission', async () => {
      const otherUser = await prismaService.user.create({
        data: {
          email: `bulk-other-${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: 'Other',
          lastName: 'User',
          username: `other_user_${Date.now()}`,
          role: Role.MEMBER,
        }
      });

      const tForbidden = await prismaService.task.create({
        data: { 
          title: 'Forbidden Task', 
          projectId, 
          statusId, 
          taskNumber: 200, 
          slug: `${projectSlug}-200`,
          createdBy: otherUser.id
        }
      });

      const memberToken = jwtService.sign({ sub: user2.id, email: user2.email, role: user2.role });

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-delete')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ taskIds: [tForbidden.id], projectId })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.deletedCount).toBe(0);
          expect(res.body.failedTasks.length).toBe(1);
          expect(res.body.failedTasks[0].reason).toContain('Insufficient permissions');
        });
    });

    it('should delete all tasks in project with all=true', async () => {
      await prismaService.task.create({
        data: { title: 'Delete Via All', projectId, statusId, taskNumber: 102, slug: `${projectSlug}-102` }
      });

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ projectId, all: true })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.deletedCount).toBeGreaterThanOrEqual(1);
        });
    });
  });
});
