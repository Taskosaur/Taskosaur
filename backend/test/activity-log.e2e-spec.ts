import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

describe('ActivityLogController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let statusId: string;
  let taskId: string;
  let taskSlug: string;

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
        email: `activity-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Activity',
        lastName: 'Tester',
        username: `activity_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Activity Org ${Date.now()}`,
        slug: `activity-org-${Date.now()}`,
        ownerId: user.id,
      },
    });
    organizationId = organization.id;

    // Create Workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: 'Default Workflow',
        organizationId: organization.id,
        isDefault: true,
      },
    });
    workflowId = workflow.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Activity Workspace ${Date.now()}`,
        slug: `activity-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Activity Project',
        slug: `activity-project-${Date.now()}`,
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

    // Create Task
    const task = await prismaService.task.create({
      data: {
        title: 'Task for Activity Log',
        projectId: projectId,
        statusId: statusId,
        createdBy: user.id,
        taskNumber: 1,
        slug: `ACTIVITY-1`,
      },
    });
    taskId = task.id;
    taskSlug = task.slug;

    // Log some activity
    await prismaService.activityLog.create({
      data: {
        type: 'TASK_CREATED',
        description: 'Created task for activity log',
        entityType: 'Task',
        entityId: taskId,
        userId: user.id,
        organizationId: organizationId,
      },
    });
  });

  describe('/activity-logs/task/:taskId/activities (GET)', () => {
    it('should list activities for a task using UUID', () => {
      return request(app.getHttpServer())
        .get(`/api/activity-logs/task/${taskId}/activities`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('activities');
          expect(Array.isArray(res.body.activities)).toBe(true);
          expect(res.body.activities.length).toBeGreaterThan(0);
        });
    });

    it('should list activities for a task using slug', () => {
      return request(app.getHttpServer())
        .get(`/api/activity-logs/task/${taskSlug}/activities`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('activities');
          expect(Array.isArray(res.body.activities)).toBe(true);
          expect(res.body.activities.length).toBeGreaterThan(0);
        });
    });

    it('should return 404 for non-existent task', () => {
      return request(app.getHttpServer())
        .get('/api/activity-logs/task/NON-EXISTENT-TASK/activities')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.activityLog.deleteMany({ where: { organizationId } });
      await prismaService.task.deleteMany({ where: { projectId } });
      await prismaService.taskStatus.deleteMany({ where: { workflowId } });
      await prismaService.project.deleteMany({ where: { id: projectId } });
      await prismaService.workspace.deleteMany({ where: { id: workspaceId } });
      await prismaService.workflow.deleteMany({ where: { id: workflowId } });
      await prismaService.organization.deleteMany({ where: { id: organizationId } });
      await prismaService.user.deleteMany({ where: { id: user.id } });
    }
    await app.close();
  });
});
