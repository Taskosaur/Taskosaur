import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility, DependencyType } from '@prisma/client';
import { CreateTaskDependencyDto } from './../src/modules/task-dependencies/dto/create-task-dependency.dto';

describe('TaskDependenciesController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let statusId: string;
  let task1Id: string;
  let task2Id: string;
  let dependencyId: string;

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
        email: `dep-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Dependency',
        lastName: 'Tester',
        username: `dep_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Dep Org ${Date.now()}`,
            slug: `dep-org-${Date.now()}`,
            ownerId: user.id,
        }
    });
    organizationId = organization.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Dep Workspace ${Date.now()}`,
        slug: `dep-workspace-${Date.now()}`,
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
        name: `Dep Workflow ${Date.now()}`,
        organizationId: organization.id,
      },
    });

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Dep Project',
        slug: `dep-project-${Date.now()}`,
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

    // Create Tasks
    const task1 = await prismaService.task.create({
      data: {
        title: 'Task 1',
        description: 'First task',
        projectId: project.id,
        statusId: status.id,
        createdBy: user.id,
        priority: 'MEDIUM',
        type: 'TASK',
        taskNumber: 1,
        slug: `dep-task-1-${Date.now()}`,
      },
    });
    task1Id = task1.id;

    const task2 = await prismaService.task.create({
      data: {
        title: 'Task 2',
        description: 'Second task',
        projectId: project.id,
        statusId: status.id,
        createdBy: user.id,
        priority: 'MEDIUM',
        type: 'TASK',
        taskNumber: 2,
        slug: `dep-task-2-${Date.now()}`,
      },
    });
    task2Id = task2.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.taskDependency.deleteMany({ where: { createdBy: user.id } });
      await prismaService.task.deleteMany({ where: { projectId } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/task-dependencies (POST)', () => {
    it('should create a dependency', () => {
      const createDto: CreateTaskDependencyDto = {
        dependentTaskId: task2Id,
        blockingTaskId: task1Id,
        type: DependencyType.BLOCKS,
        createdBy: user.id,
      };

      return request(app.getHttpServer())
        .post('/api/task-dependencies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.dependentTaskId).toBe(task2Id);
          expect(res.body.blockingTaskId).toBe(task1Id);
          dependencyId = res.body.id;
        });
    });
  });

  describe('/task-dependencies (GET)', () => {
    it('should list dependencies', () => {
      return request(app.getHttpServer())
        .get('/api/task-dependencies')
        .query({ projectId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const dep = res.body.find((d: any) => d.id === dependencyId);
          expect(dep).toBeDefined();
        });
    });
  });

  describe('/task-dependencies/:id (DELETE)', () => {
    it('should delete a dependency', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-dependencies/${dependencyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
