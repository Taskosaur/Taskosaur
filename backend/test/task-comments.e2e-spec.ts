import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
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

    // Add user to project
    await prismaService.projectMember.create({
      data: {
        userId: user.id,
        projectId: project.id,
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

  describe('/task-comments (POST) - Mentions Hardening', () => {
    let mentionedUser: any;

    beforeAll(async () => {
      mentionedUser = await prismaService.user.create({
        data: {
          email: `mentioned-${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: 'Mentioned',
          lastName: 'User',
          username: `mentioned_${Date.now()}`,
          role: Role.MEMBER,
        },
      });
      // Add to organization so they can be notified
      await prismaService.organizationMember.create({
        data: {
          organizationId: organizationId,
          userId: mentionedUser.id,
          role: Role.MEMBER,
        },
      });
    });

    afterAll(async () => {
      await prismaService.notification.deleteMany({ where: { userId: mentionedUser.id } });
      await prismaService.organizationMember.deleteMany({ where: { userId: mentionedUser.id } });
      await prismaService.user.delete({ where: { id: mentionedUser.id } });
    });

    it('should notify mentioned user but NOT on email addresses', async () => {
      const content = `Hello @${mentionedUser.username}, please check user@example.com`;
      const createDto: CreateTaskCommentDto = {
        content,
        taskId: taskId,
      };

      await request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED);

      // Check notifications for mentionedUser
      const notifications = await prismaService.notification.findMany({
        where: { 
          userId: mentionedUser.id,
          type: 'MENTION'
        }
      });

      // Should have 1 notification for the valid mention, and 0 for the email address
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain(`mentioned you`);
      
      // Also verify that "example.com" was not treated as a mention (if there was a user with that name)
      // This is implicit since we only have one MENTION notification for this user.
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
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ content: 'Hacked content' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should fail to delete another users comment', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-comments/${commentId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/task-comments (POST) - Validation', () => {
    it('should fail to create a comment with empty content', () => {
      const createDto = {
        content: '',
        taskId: taskId,
      };

      return request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should fail to create a comment on archived task', async () => {
      // Create an archived task
      const archivedTask = await prismaService.task.create({
        data: {
          title: 'Archived Task',
          description: 'This task is archived',
          projectId: projectId,
          statusId: statusId,
          createdBy: user.id,
          priority: 'MEDIUM',
          type: 'TASK',
          taskNumber: 2,
          slug: `archived-task-${Date.now()}`,
          isArchived: true,
        },
      });

      const createDto = {
        content: 'Comment on archived task',
        taskId: archivedTask.id,
      };

      return request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.FORBIDDEN)
        .then((res) => {
          expect(res.body.message).toContain('archived');
        });
    });

    it('should fail to reply to non-existent parent comment', () => {
      const createDto: CreateTaskCommentDto = {
        content: 'Reply to non-existent comment',
        taskId: taskId,
        parentCommentId: '00000000-0000-0000-0000-000000000000',
      };

      return request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.NOT_FOUND)
        .expect((res) => {
          expect(res.body.message).toContain('Parent comment not found');
        });
    });

    it('should fail to reply with parent comment from different task', async () => {
      // Create another task
      const otherTask = await prismaService.task.create({
        data: {
          title: 'Other Task',
          description: 'Different task',
          projectId: projectId,
          statusId: statusId,
          createdBy: user.id,
          priority: 'MEDIUM',
          type: 'TASK',
          taskNumber: 3,
          slug: `other-task-${Date.now()}`,
        },
      });

      // Create a comment on the other task
      const otherComment = await prismaService.taskComment.create({
        data: {
          content: 'Comment on other task',
          taskId: otherTask.id,
          authorId: user.id,
        },
      });

      // Try to reply to that comment from our original task
      const createDto: CreateTaskCommentDto = {
        content: 'Invalid reply',
        taskId: taskId,
        parentCommentId: otherComment.id,
      };

      return request(app.getHttpServer())
        .post('/api/task-comments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((res) => {
          expect(res.body.message).toContain('same task');
        });
    });
  });

  describe('/task-comments/:id (PATCH)', () => {
    it('should update a comment', () => {
      const updateDto = { content: 'Updated content' };
      return request(app.getHttpServer())
        .patch(`/api/task-comments/${commentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.content).toBe(updateDto.content);
        });
    });

    it('should fail to update a comment on archived task', async () => {
      // Create an archived task
      const archivedTask = await prismaService.task.create({
        data: {
          title: 'Archived Task for Update',
          description: 'This task is archived',
          projectId: projectId,
          statusId: statusId,
          createdBy: user.id,
          priority: 'MEDIUM',
          type: 'TASK',
          taskNumber: 4,
          slug: `archived-task-update-${Date.now()}`,
          isArchived: true,
        },
      });

      // Create a comment on the archived task
      const archivedComment = await prismaService.taskComment.create({
        data: {
          content: 'Comment on archived task',
          taskId: archivedTask.id,
          authorId: user.id,
        },
      });

      // Try to update the comment
      const updateDto = { content: 'Updated content on archived task' };
      return request(app.getHttpServer())
        .patch(`/api/task-comments/${archivedComment.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.FORBIDDEN)
        .expect((res) => {
          expect(res.body.message).toContain('archived');
        });
    });
  });

  describe('/task-comments/:id (DELETE)', () => {
    it('should delete a comment', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-comments/${commentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
