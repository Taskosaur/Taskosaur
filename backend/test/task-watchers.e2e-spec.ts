import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

describe('TaskWatchersController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let otherUser: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
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

    // Create test users
    user = await prismaService.user.create({
      data: {
        email: `watcher-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Watcher',
        lastName: 'Tester',
        username: `watcher_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    otherUser = await prismaService.user.create({
      data: {
        email: `other-watcher-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Other',
        lastName: 'Watcher',
        username: `other_watcher_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Watcher Org ${Date.now()}`,
            slug: `watcher-org-${Date.now()}`,
            ownerId: user.id,
        }
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
        name: `Watcher Workspace ${Date.now()}`,
        slug: `watcher-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Watcher Project',
        slug: `watcher-project-${Date.now()}`,
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

    // Add users as Project Members
    await prismaService.projectMember.createMany({
      data: [
        {
          projectId: projectId,
          userId: user.id,
          role: Role.OWNER,
        },
        {
          projectId: projectId,
          userId: otherUser.id,
          role: Role.MEMBER,
        }
      ],
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
        title: 'Task for Watching',
        projectId: projectId,
        statusId: statusId,
        createdBy: user.id,
        taskNumber: 1,
        slug: `WATCH-1`,
      },
    });
    taskId = task.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.taskWatcher.deleteMany({ where: { taskId } });
      await prismaService.task.delete({ where: { id: taskId } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } });
    }
    await app.close();
  });

  describe('Watcher Operations', () => {
    
    afterEach(async () => {
        await prismaService.taskWatcher.deleteMany({ where: { taskId } });
    });

    describe('/task-watchers/watch (POST)', () => {
        it('should start watching a task', () => {
          return request(app.getHttpServer())
            .post('/api/task-watchers/watch')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ taskId, userId: user.id })
            .expect(HttpStatus.CREATED)
            .expect((res) => {
              expect(res.body.taskId).toBe(taskId);
              expect(res.body.userId).toBe(user.id);
            });
        });
    
        it('should return 409 if already watching', async () => {
          await prismaService.taskWatcher.create({ data: { taskId, userId: user.id } });

          return request(app.getHttpServer())
            .post('/api/task-watchers/watch')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ taskId, userId: user.id })
            .expect(HttpStatus.CONFLICT);
        });
      });
    
      describe('/task-watchers/check/:taskId/:userId (GET)', () => {
        it('should check if user is watching task', async () => {
          await prismaService.taskWatcher.create({ data: { taskId, userId: user.id } });

          return request(app.getHttpServer())
            .get(`/api/task-watchers/check/${taskId}/${user.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(HttpStatus.OK)
            .expect((res) => {
              expect(JSON.parse(res.text)).toBe(true);
            });
        });
    
        it('should return false if user is not watching', () => {
            return request(app.getHttpServer())
              .get(`/api/task-watchers/check/${taskId}/${otherUser.id}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(HttpStatus.OK)
              .expect((res) => {
                expect(JSON.parse(res.text)).toBe(false);
              });
          });
      });
    
      describe('/task-watchers/task/:taskId (GET)', () => {
        it('should list watchers for a task', async () => {
          await prismaService.taskWatcher.create({ data: { taskId, userId: user.id } });

          return request(app.getHttpServer())
            .get(`/api/task-watchers/task/${taskId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(HttpStatus.OK)
            .expect((res) => {
              expect(Array.isArray(res.body)).toBe(true);
              expect(res.body.some((w: any) => w.userId === user.id)).toBe(true);
            });
        });
      });
    
      describe('/task-watchers/unwatch (POST)', () => {
        it('should stop watching a task', async () => {
          await prismaService.taskWatcher.create({ data: { taskId, userId: user.id } });

          return request(app.getHttpServer())
            .post('/api/task-watchers/unwatch')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ taskId, userId: user.id })
            .expect(HttpStatus.NO_CONTENT);
        });
      });
    
      describe('/task-watchers/toggle (POST)', () => {
        it('should toggle watch status to ON', () => {
          return request(app.getHttpServer())
            .post('/api/task-watchers/toggle')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ taskId, userId: otherUser.id })
            .expect((res) => {
                if (res.status !== 200 && res.status !== 201) {
                    throw new Error(`Expected 200 or 201, got ${res.status}`);
                }
            })
            .expect((res) => {
               expect(res.body.isWatching).toBe(true);
            });
        });
    
        it('should toggle watch status to OFF', async () => {
            await prismaService.taskWatcher.create({ data: { taskId, userId: otherUser.id } });

            return request(app.getHttpServer())
              .post('/api/task-watchers/toggle')
              .set('Authorization', `Bearer ${accessToken}`)
              .send({ taskId, userId: otherUser.id })
              .expect((res) => {
                if (res.status !== 200 && res.status !== 201 && res.status !== 204) {
                    throw new Error(`Expected 200, 201 or 204, got ${res.status}`);
                }
              })
              .expect((res) => {
                expect(res.body.isWatching).toBe(false);
              });
          });
      });
  });
});
