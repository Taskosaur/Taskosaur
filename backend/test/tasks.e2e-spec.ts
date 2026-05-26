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
  let taskSlug: string;
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
      },
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
        slug: `${project.slug}-PR`,
      },
    });
    parentTaskId = parentTask.id;
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
          taskSlug = res.body.slug;
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

    it('should create a task with parentTaskId as a slug', async () => {
      const parentTask = await prismaService.task.findUnique({
        where: { id: parentTaskId },
        select: { slug: true },
      });

      const createDto: CreateTaskDto = {
        title: 'Subtask by Slug',
        projectId: projectId,
        statusId: statusId,
        parentTaskId: parentTask!.slug,
      };

      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.parentTaskId).toBe(parentTaskId);
        });
    });

    it('should return 403 when user has no project access', async () => {
      // Create a user without project membership
      const unauthorizedUser = await prismaService.user.create({
        data: {
          email: `task-unauthorized-${Date.now()}@example.com`,
          password: 'StrongPassword123!',
          firstName: 'Unauthorized',
          lastName: 'User',
          username: `task_unauthorized_${Date.now()}`,
          role: Role.MEMBER,
        },
      });
      const unauthorizedToken = jwtService.sign({
        sub: unauthorizedUser.id,
        email: unauthorizedUser.email,
        role: unauthorizedUser.role,
      });

      const createDto: CreateTaskDto = {
        title: 'Unauthorized Task',
        projectId: projectId,
        statusId: statusId,
      };

      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send(createDto)
        .expect(HttpStatus.FORBIDDEN);

      // Cleanup unauthorized user
      await prismaService.user.delete({ where: { id: unauthorizedUser.id } });
    });

    it('should return 403 when project not found or no access', async () => {
      // Note: When project doesn't exist, access control check fails first with 403
      // This is because getProjectAccess returns false for non-existent projects
      const invalidProjectId = '00000000-0000-0000-0000-000000000000';
      const createDto: CreateTaskDto = {
        title: 'Invalid Project Task',
        projectId: invalidProjectId,
        statusId: statusId,
      };

      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 when start date is after due date', async () => {
      const createDto: CreateTaskDto = {
        title: 'Invalid Dates Task',
        projectId: projectId,
        statusId: statusId,
        startDate: new Date(Date.now() + 86400000 * 10).toISOString(), // 10 days in future
        dueDate: new Date(Date.now() + 86400000).toISOString(), // 1 day in future
      };

      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((res) => {
          expect(res.body.message).toContain('Start date must be before the due date');
        });
    });

    it('should auto-assign default sprint when sprintId not provided', async () => {
      // Create a default sprint for this project
      const defaultSprint = await prismaService.sprint.create({
        data: {
          name: 'Default Sprint',
          projectId: projectId,
          status: 'ACTIVE',
          isDefault: true,
        },
      });

      const createDto: CreateTaskDto = {
        title: 'Auto Sprint Task',
        projectId: projectId,
        statusId: statusId,
        // No sprintId provided - should use default
      };

      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe(createDto.title);
          expect(res.body.sprintId).toBe(defaultSprint.id);
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
            t.assignees.some((a: any) => a.id === user2.id),
          );
          expect(includesUser2).toBe(true);
        });
    });

    it('should filter tasks by reporterIds', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, reporterIds: user.id })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const includesUser = res.body.data.every((t: any) =>
            t.reporters.some((r: any) => r.id === user.id),
          );
          expect(includesUser).toBe(true);
        });
    });

    it('should filter tasks by workspaceId', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, workspaceId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const allInWorkspace = res.body.data.every(
            (t: any) => t.project.workspace.id === workspaceId,
          );
          expect(allInWorkspace).toBe(true);
        });
    });

    it('should filter tasks by parentTaskId', async () => {
      // Create a subtask
      await prismaService.task.create({
        data: {
          title: 'Subtask',
          projectId,
          statusId,
          parentTaskId,
          taskNumber: 10,
          slug: `${projectSlug}-10`,
        },
      });

      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, parentTaskId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const allAreSubtasks = res.body.data.every((t: any) => t.parentTaskId === parentTaskId);
          expect(allAreSubtasks).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('should filter tasks by parentTaskId using slug', async () => {
      const parentTask = await prismaService.task.findUnique({
        where: { id: parentTaskId },
        select: { slug: true },
      });

      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, parentTaskId: parentTask!.slug })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const allAreSubtasks = res.body.data.every((t: any) => t.parentTaskId === parentTaskId);
          expect(allAreSubtasks).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('should filter tasks by parentTaskId=null', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, parentTaskId: 'null' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const allAreMainTasks = res.body.data.every((t: any) => t.parentTaskId === null);
          expect(allAreMainTasks).toBe(true);
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

    it('should test grouping (groupBy)', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, groupBy: 'priority' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('should test grouping by status (groupBy=status)', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, groupBy: 'status' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('should test grouping page boundaries and prevent group splits (groupBy=status)', async () => {
      const statusRes = await request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId, groupBy: 'status' })
        .set('Authorization', `Bearer ${accessToken}`);

      const tasks = statusRes.body.data;
      if (tasks.length >= 2) {
        const res = await request(app.getHttpServer())
          .get('/api/tasks')
          .query({ organizationId, groupBy: 'status', limit: 1 })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);

        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);

        const page1Tasks = res.body.data;
        const page2Res = await request(app.getHttpServer())
          .get('/api/tasks')
          .query({ organizationId, groupBy: 'status', limit: 1, page: 2 })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);

        const page2Tasks = page2Res.body.data;

        const page1StatusIds = new Set(page1Tasks.map((t: any) => t.statusId));
        const page2StatusIds = new Set(page2Tasks.map((t: any) => t.statusId));

        for (const statusId of page1StatusIds) {
          expect(page2StatusIds.has(statusId)).toBe(false);
        }
      }
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
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should fetch tasks for GANTT view including subtasks and honoring sprintId', async () => {
      // Create a test task and subtask in the sprint
      const ganttTask = await prismaService.task.create({
        data: {
          title: 'Gantt Test Task',
          projectId,
          statusId,
          sprintId,
          taskNumber: 8000,
          slug: `${projectSlug}-8000`,
        },
      });

      await prismaService.task.create({
        data: {
          title: 'Gantt Test Subtask',
          projectId,
          statusId,
          sprintId,
          parentTaskId: ganttTask.id,
          taskNumber: 8001,
          slug: `${projectSlug}-8001`,
        },
      });

      return request(app.getHttpServer())
        .get('/api/tasks/all-tasks')
        .query({
          organizationId,
          viewType: 'GANTT',
          parentTaskId: 'all',
          sprintId: sprintId,
          sortBy: 'listRank',
          sortOrder: 'asc'
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          // Should include both the main task and the subtask
          const taskIds = res.body.data.map((t: any) => t.id);
          expect(taskIds.includes(ganttTask.id)).toBe(true);
          
          // Verify sprintId is honored (all returned tasks should belong to the sprint)
          const allMatchSprint = res.body.data.every((t: any) => !t.sprintId || t.sprintId === sprintId);
          expect(allMatchSprint).toBe(true);
        });
    });
  });

  describe('/tasks/by-status (GET)', () => {
    it('should get tasks grouped by status and validate meta data', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/by-status')
        .query({ slug: projectSlug })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body).toHaveProperty('meta');
          expect(res.body.meta).toHaveProperty('totalTasks');
          expect(res.body.meta).toHaveProperty('loadedTasks');
          expect(res.body.meta).toHaveProperty('totalStatuses');
          expect(res.body.meta).toHaveProperty('fetchedAt');
        });
    });
  });

  describe('/tasks/grouped (GET)', () => {
    it('should get tasks grouped by status (initial load)', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/grouped')
        .query({ organizationId, groupBy: 'status' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('groups');
          expect(Array.isArray(res.body.groups)).toBe(true);
          expect(res.body).toHaveProperty('groupBy');
          expect(res.body.groupBy).toBe('status');

          if (res.body.groups.length > 0) {
            const group = res.body.groups[0];
            expect(group).toHaveProperty('key');
            expect(group).toHaveProperty('label');
            expect(group).toHaveProperty('totalCount');
            expect(group).toHaveProperty('tasks');
            expect(Array.isArray(group.tasks)).toBe(true);
          }
        });
    });

    it('should get tasks grouped by priority (initial load)', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/grouped')
        .query({ organizationId, groupBy: 'priority' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.groupBy).toBe('priority');
          expect(Array.isArray(res.body.groups)).toBe(true);
        });
    });

    it('should support load-more mode for a specific group key', async () => {
      // 1. First request to get all groups and find a key
      const initialRes = await request(app.getHttpServer())
        .get('/api/tasks/grouped')
        .query({ organizationId, groupBy: 'status' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      if (initialRes.body.groups.length > 0) {
        const targetGroupKey = initialRes.body.groups[0].key;

        // 2. Request details for that group key in load-more mode
        await request(app.getHttpServer())
          .get('/api/tasks/grouped')
          .query({
            organizationId,
            groupBy: 'status',
            groupKey: targetGroupKey,
            page: 1,
            limitPerGroup: 2,
          })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK)
          .expect((res) => {
            expect(res.body).toHaveProperty('groups');
            expect(res.body.groups.length).toBe(1);
            expect(res.body.groups[0].key).toBe(targetGroupKey);
            expect(res.body.groups[0]).toHaveProperty('page');
            expect(res.body.groups[0].page).toBe(1);
          });
      }
    });

    it('should apply filters (e.g. projectId) correctly', async () => {
      await request(app.getHttpServer())
        .get('/api/tasks/grouped')
        .query({ organizationId, groupBy: 'status', projectId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.groupBy).toBe('status');
          for (const group of res.body.groups) {
            for (const task of group.tasks) {
              expect(task.projectId).toBe(projectId);
            }
          }
        });
    });

    it('should fail if organizationId is missing', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/grouped')
        .query({ groupBy: 'status' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should fail if groupBy is missing or invalid', () => {
      return request(app.getHttpServer())
        .get('/api/tasks/grouped')
        .query({ organizationId, groupBy: 'invalid_field' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.BAD_REQUEST);
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
        select: { slug: true },
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
    it('should get a task by UUID', () => {
      return request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(taskId);
          expect(res.body.title).toBe('E2E Task');
        });
    });

    it('should get a task by slug', () => {
      return request(app.getHttpServer())
        .get(`/api/tasks/${taskSlug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(taskId);
          expect(res.body.slug).toBe(taskSlug);
        });
    });
  });

  describe('/tasks/:id (PATCH)', () => {
    it('should update a task by UUID', () => {
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
    it('should update a task using its slug in the URL', () => {
      const updateDto = { title: 'Updated E2E Task by Slug' };
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskSlug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.title).toBe(updateDto.title);
        });
    });

    it('should update a task parentTaskId using a slug', async () => {
      // Create another task to be the new parent
      const newParentTask = await prismaService.task.create({
        data: {
          title: 'New Parent Task',
          projectId,
          statusId,
          taskNumber: 20,
          slug: `${projectSlug}-20`,
          createdBy: user.id,
        },
      });

      const updateDto = { parentTaskId: newParentTask.slug };
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.parentTaskId).toBe(newParentTask.id);
        });
    });
  });

  describe('/tasks/:id/status (PATCH)', () => {
    it('should update task status by slug', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskSlug}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ statusId })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.statusId).toBe(statusId);
        });
    });
  });

  describe('/tasks/:id/assignees (PATCH)', () => {
    it('should update task assignees by slug', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskSlug}/assignees`)
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
    it('should unassign all users from a task by slug', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskSlug}/unassign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.assignees.length).toBe(0);
        });
    });
  });

  describe('/tasks/:id/priority (PATCH)', () => {
    it('should update task priority by slug', () => {
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskSlug}/priority`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ priority: 'LOW' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.priority).toBe('LOW');
        });
    });
  });

  describe('/tasks/:id/due-date (PATCH)', () => {
    it("should update task's due date by slug", () => {
      const dueDate = new Date().toISOString();
      return request(app.getHttpServer())
        .patch(`/api/tasks/${taskSlug}/due-date`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ dueDate })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(new Date(res.body.dueDate).toISOString()).toBe(dueDate);
        });
    });
  });

  describe('/tasks/:id/comments (POST)', () => {
    it('should add a comment to a task by slug', () => {
      return request(app.getHttpServer())
        .post(`/api/tasks/${taskSlug}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ comment: 'Test Shortcut Comment' })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.content).toBe('Test Shortcut Comment');
          expect(res.body.taskId).toBe(taskId);
        });
    });
  });

  describe('/tasks/:id (DELETE)', () => {
    it('should delete a task by slug', async () => {
      // Create a task specifically for deletion
      const taskToDelete = await prismaService.task.create({
        data: {
          title: 'Task to Delete by Slug',
          projectId,
          statusId,
          taskNumber: 1000,
          slug: `${projectSlug}-1000`,
        },
      });

      return request(app.getHttpServer())
        .delete(`/api/tasks/${taskToDelete.slug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });

    it('should delete a task by UUID', async () => {
      // Create a task specifically for deletion
      const taskToDelete = await prismaService.task.create({
        data: {
          title: 'Task to Delete by UUID',
          projectId,
          statusId,
          taskNumber: 999,
          slug: `${projectSlug}-999`,
        },
      });

      return request(app.getHttpServer())
        .delete(`/api/tasks/${taskToDelete.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });

    it('should fail to delete a non-existent task', () => {
      const fakeTaskId = '00000000-0000-0000-0000-000000000000';
      return request(app.getHttpServer())
        .delete(`/api/tasks/${fakeTaskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
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
        data: {
          title: 'Delete Me 1',
          projectId,
          statusId,
          taskNumber: 100,
          slug: `${projectSlug}-100`,
        },
      });
      const t2 = await prismaService.task.create({
        data: {
          title: 'Delete Me 2',
          projectId,
          statusId,
          taskNumber: 101,
          slug: `${projectSlug}-101`,
        },
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

    it('should delete multiple tasks with excludedIds', async () => {
      const t1 = await prismaService.task.create({
        data: {
          title: 'Delete Me 3',
          projectId,
          statusId,
          taskNumber: 103,
          slug: `${projectSlug}-103`,
        },
      });
      const t2 = await prismaService.task.create({
        data: {
          title: 'Delete Me 4',
          projectId,
          statusId,
          taskNumber: 104,
          slug: `${projectSlug}-104`,
        },
      });

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ taskIds: [t1.id, t2.id], excludedIds: [t2.id], projectId })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.deletedCount).toBe(1);
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
        },
      });

      const tForbidden = await prismaService.task.create({
        data: {
          title: 'Forbidden Task',
          projectId,
          statusId,
          taskNumber: 200,
          slug: `${projectSlug}-200`,
          createdBy: otherUser.id,
        },
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
        data: {
          title: 'Delete Via All',
          projectId,
          statusId,
          taskNumber: 102,
          slug: `${projectSlug}-102`,
        },
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

    it('should delete all tasks in project except excludedIds with all=true', async () => {
      const tKeep = await prismaService.task.create({
        data: {
          title: 'Keep Me',
          projectId,
          statusId,
          taskNumber: 105,
          slug: `${projectSlug}-105`,
        },
      });

      await request(app.getHttpServer())
        .post('/api/tasks/bulk-delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ projectId, all: true, excludedIds: [tKeep.id] })
        .expect(HttpStatus.OK);

      const keptTask = await prismaService.task.findUnique({ where: { id: tKeep.id } });
      expect(keptTask).not.toBeNull();
    });
  });

  describe('/tasks/bulk-create (POST)', () => {
    it('should bulk create multiple tasks successfully', async () => {
      const bulkCreateDto = {
        projectId,
        statusId,
        tasks: [
          {
            title: 'Bulk Task 1',
            description: 'First bulk task',
            type: 'TASK',
            priority: 'MEDIUM',
          },
          {
            title: 'Bulk Task 2',
            description: 'Second bulk task',
            type: 'STORY',
            priority: 'HIGH',
          },
          {
            title: 'Bulk Task 3',
            type: 'BUG',
            priority: 'CRITICAL',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.created).toBe(3);
          expect(res.body.failed).toBe(0);
          expect(res.body.failures).toEqual([]);
        });
    });

    it('should bulk create with partial failures (some invalid tasks)', async () => {
      const bulkCreateDto = {
        projectId,
        statusId,
        tasks: [
          {
            title: 'Valid Task 1',
            description: 'This should succeed',
            type: 'TASK',
            priority: 'LOW',
          },
          { title: '', description: 'Empty title should fail', type: 'TASK', priority: 'MEDIUM' },
          { title: 'Valid Task 2', type: 'STORY', priority: 'HIGH' },
          { title: 'A'.repeat(501), description: 'Title too long', type: 'TASK', priority: 'LOW' },
          { title: 'Valid Task 3', type: 'BUG', priority: 'CRITICAL' },
        ],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.created).toBe(3);
          expect(res.body.failed).toBe(2);
          expect(res.body.failures.length).toBe(2);
          expect(res.body.failures.map((f: any) => f.reason)).toContain('Title is required');
          expect(res.body.failures.map((f: any) => f.reason)).toContain(
            'Title exceeds maximum length of 500 characters',
          );
        });
    });

    it('should bulk create with all invalid tasks', async () => {
      const bulkCreateDto = {
        projectId,
        statusId,
        tasks: [
          { title: '', description: 'Empty title' },
          { title: '', description: 'Another empty title' },
        ],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.created).toBe(0);
          expect(res.body.failed).toBe(2);
          expect(res.body.failures.length).toBe(2);
        });
    });

    it('should fail bulk create with empty tasks array', () => {
      const bulkCreateDto = {
        projectId,
        statusId,
        tasks: [],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((res) => {
          expect(res.body.message).toContain('empty');
        });
    });

    it('should fail bulk create with invalid project ID', () => {
      const bulkCreateDto = {
        projectId: '00000000-0000-0000-0000-000000000000',
        statusId,
        tasks: [{ title: 'Test Task', type: 'TASK', priority: 'MEDIUM' }],
      };

      // Note: Returns 403 because getProjectAccess checks permissions and throws
      // ForbiddenException when user has no access to the (non-existent) project
      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should fail bulk create with invalid status ID', () => {
      const bulkCreateDto = {
        projectId,
        statusId: '00000000-0000-0000-0000-000000000000',
        tasks: [{ title: 'Test Task', type: 'TASK', priority: 'MEDIUM' }],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should fail bulk create with unauthorized user', async () => {
      const memberToken = jwtService.sign({ sub: user2.id, email: user2.email, role: user2.role });
      const bulkCreateDto = {
        projectId,
        statusId,
        tasks: [{ title: 'Test Task', type: 'TASK', priority: 'MEDIUM' }],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should bulk create with optional sprintId', async () => {
      const bulkCreateDto = {
        projectId,
        statusId,
        sprintId,
        tasks: [
          { title: 'Sprint Task 1', type: 'STORY', priority: 'MEDIUM' },
          { title: 'Sprint Task 2', type: 'TASK', priority: 'LOW' },
        ],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.created).toBe(2);
          expect(res.body.failed).toBe(0);
        });
    });

    it('should bulk create tasks without optional fields', async () => {
      const bulkCreateDto = {
        projectId,
        statusId,
        tasks: [{ title: 'Minimal Task 1' }, { title: 'Minimal Task 2' }],
      };

      return request(app.getHttpServer())
        .post('/api/tasks/bulk-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bulkCreateDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.created).toBe(2);
          expect(res.body.failed).toBe(0);
        });
    });
  });

  describe('Recurring Tasks', () => {
    let recurringTaskId: string;

    it('should add recurrence to an existing task (POST /tasks/:id/recurrence)', async () => {
      const task = await prismaService.task.create({
        data: {
          title: 'Recurring Task Base',
          projectId,
          statusId,
          taskNumber: 300,
          slug: `${projectSlug}-300`,
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      recurringTaskId = task.id;

      const recurrenceConfig = {
        recurrenceType: 'WEEKLY',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        endType: 'NEVER',
      };

      return request(app.getHttpServer())
        .post(`/api/tasks/${recurringTaskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(recurrenceConfig)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.recurrenceType).toBe('WEEKLY');
          expect(res.body.interval).toBe(1);
          expect(res.body.isActive).toBe(true);
        });
    });

    it('should update recurrence configuration (PATCH /tasks/:id/recurrence)', () => {
      const updateConfig = {
        recurrenceType: 'MONTHLY',
        interval: 2,
        dayOfMonth: 15,
        endType: 'AFTER_OCCURRENCES',
        occurrenceCount: 10,
      };

      return request(app.getHttpServer())
        .patch(`/api/tasks/${recurringTaskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateConfig)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.recurrenceType).toBe('MONTHLY');
          expect(res.body.interval).toBe(2);
          expect(res.body.occurrenceCount).toBe(10);
        });
    });

    it('should get recurring tasks for a project (GET /tasks/recurring/project/:projectId)', () => {
      return request(app.getHttpServer())
        .get(`/api/tasks/recurring/project/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.some((t: any) => t.id === recurringTaskId)).toBe(true);
        });
    });

    it('should complete occurrence and generate next task (POST /tasks/:id/complete-occurrence)', async () => {
      return (
        request(app.getHttpServer())
          .post(`/api/tasks/${recurringTaskId}/complete-occurrence`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.CREATED) // TasksService.create returns the created task, and completeOccurrenceAndGenerateNext returns {completedTask, nextTask}
          // Wait, completeOccurrenceAndGenerateNext calls this.create which uses tx.task.create.
          // But the controller doesn't specify HttpCode(201) for this, and it's a POST, so default is 201.
          .expect((res) => {
            expect(res.body).toHaveProperty('completedTask');
            expect(res.body).toHaveProperty('nextTask');
            expect(res.body.completedTask.id).toBe(recurringTaskId);
            expect(res.body.completedTask.completedAt).not.toBeNull();
            expect(res.body.nextTask.title).toBe(res.body.completedTask.title);
          })
      );
    });

    it('should stop recurrence (DELETE /tasks/:id/recurrence)', () => {
      return request(app.getHttpServer())
        .delete(`/api/tasks/${recurringTaskId}/recurrence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.isRecurring).toBe(false);
        });
    });
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
});
