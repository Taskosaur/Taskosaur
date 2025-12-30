import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { CreateTaskCommentDto } from './../src/modules/task-comments/dto/create-task-comment.dto';

describe('TaskCommentsController (e2e)', () => {
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
  let commentId: string;

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
        email: `comment-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Comment',
        lastName: 'Tester',
        username: `comment_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Comment Org ${Date.now()}`,
            slug: `comment-org-${Date.now()}`,
            ownerId: user.id,
        }
    });
    organizationId = organization.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Comment Workspace ${Date.now()}`,
        slug: `comment-workspace-${Date.now()}`,
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
        name: `Comment Workflow ${Date.now()}`,
        organizationId: organization.id,
      },
    });

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Comment Project',
        slug: `comment-project-${Date.now()}`,
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

    // Create Task
    const task = await prismaService.task.create({
      data: {
        title: 'Task for Comments',
        description: 'This task is for testing comments',
        projectId: project.id,
        statusId: status.id,
        createdBy: user.id,
        priority: 'MEDIUM',
        type: 'TASK',
        taskNumber: 1,
        slug: `task-for-comments-${Date.now()}`,
      },
    });
    taskId = task.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.taskComment.deleteMany({ where: { taskId } });
      await prismaService.task.delete({ where: { id: taskId } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/task-comments (POST)', () => {
    it('should create a comment', () => {
      const createDto: CreateTaskCommentDto = {
        content: 'This is a test comment',
        taskId: taskId,
        authorId: user.id,
      };

      return request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.content).toBe(createDto.content);
          expect(res.body.taskId).toBe(taskId);
          commentId = res.body.id;
        });
    });
  });

  describe('/task-comments (GET)', () => {
    it('should get comments for a task', () => {
      return request(app.getHttpServer())
        .get('/api/task-comments')
        .query({ taskId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          const comment = res.body.data.find((c: any) => c.id === commentId);
          expect(comment).toBeDefined();
        });
    });
  });

  describe('/task-comments (POST) - Reply', () => {
    it('should create a reply to a comment', () => {
      const createDto: CreateTaskCommentDto = {
        content: 'This is a reply',
        taskId: taskId,
        authorId: user.id,
        parentCommentId: commentId,
      };

      return request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.content).toBe(createDto.content);
          expect(res.body.parentCommentId).toBe(commentId);
        });
    });
  });

  describe('/task-comments/:id/replies (GET)', () => {
    it('should get replies for a comment', () => {
      return request(app.getHttpServer())
        .get(`/api/task-comments/${commentId}/replies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].parentCommentId).toBe(commentId);
        });
    });
  });

  describe('/task-comments/task/:taskId/tree (GET)', () => {
    it('should get the comment tree for a task', () => {
      return request(app.getHttpServer())
        .get(`/api/task-comments/task/${taskId}/tree`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const parent = res.body.find((c: any) => c.id === commentId);
          expect(parent).toBeDefined();
          expect(parent.replies).toBeDefined();
          expect(parent.replies.length).toBeGreaterThan(0);
        });
    });
  });

  describe('/task-comments/middle-pagination (GET)', () => {
    it('should get comments with middle pagination', () => {
      return request(app.getHttpServer())
        .get('/api/task-comments/middle-pagination')
        .query({ taskId, page: 1, limit: 5 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/task-comments (Unauthorized Access)', () => {
    let otherUser: any;
    let otherUserToken: string;

    beforeAll(async () => {
      // Create another user
      otherUser = await prismaService.user.create({
        data: {
          email: `comment-intruder-${Date.now()}@example.com`,
          password: 'StrongPassword123!',
          firstName: 'Intruder',
          lastName: 'User',
          username: `intruder_${Date.now()}`,
          role: Role.MEMBER,
        },
      });
      const payload = { sub: otherUser.id, email: otherUser.email, role: otherUser.role };
      otherUserToken = jwtService.sign(payload);
    });

    afterAll(async () => {
      await prismaService.user.delete({ where: { id: otherUser.id } });
    });

    it('should fail to update another users comment', () => {
      return request(app.getHttpServer())
        .patch(`/api/task-comments/${commentId}`)
        .query({ userId: otherUser.id })
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ content: 'Hacked content' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should fail to delete another users comment', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-comments/${commentId}`)
        .query({ userId: otherUser.id })
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/task-comments/:id (PATCH)', () => {
    it('should update a comment', () => {
      const updateDto = { content: 'Updated content' };
      return request(app.getHttpServer())
        .patch(`/api/task-comments/${commentId}`)
        .query({ userId: user.id }) // Passing userId as per controller requirement
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.content).toBe(updateDto.content);
        });
    });
  });

  describe('/task-comments/:id (DELETE)', () => {
    it('should delete a comment', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-comments/${commentId}`)
        .query({ userId: user.id }) // Passing userId as per controller requirement
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
