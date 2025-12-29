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
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
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
});
