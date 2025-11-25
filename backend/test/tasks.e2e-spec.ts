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
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
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
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.task.deleteMany({ where: { projectId } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/tasks (POST)', () => {
    it('should create a task', () => {
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
          expect(res.body.projectId).toBe(projectId);
          taskId = res.body.id;
        });
    });
  });

  describe('/tasks (GET)', () => {
    it('should list tasks', () => {
      return request(app.getHttpServer())
        .get('/api/tasks')
        .query({ organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          const task = res.body.data.find((t: any) => t.id === taskId);
          expect(task).toBeDefined();
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
