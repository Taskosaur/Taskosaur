import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

describe('TaskAttachmentsController (e2e)', () => {
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

  const testFilePath = path.join(__dirname, 'test-file.txt');

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
        email: `attachment-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Attachment',
        lastName: 'Tester',
        username: `attach_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Attach Org ${Date.now()}`,
            slug: `attach-org-${Date.now()}`,
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
        name: `Attach Workspace ${Date.now()}`,
        slug: `attach-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Attach Project',
        slug: `attach-project-${Date.now()}`,
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
        title: 'Task with Attachments',
        projectId: projectId,
        statusId: statusId,
        createdBy: user.id,
        taskNumber: 1,
        slug: `ATTACH-1`,
      },
    });
    taskId = task.id;

    // Create a dummy test file
    fs.writeFileSync(testFilePath, 'This is a test file for e2e attachment testing.');
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.taskAttachment.deleteMany({ where: { taskId } });
      await prismaService.task.delete({ where: { id: taskId } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }

    if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
    }

    await app.close();
  });

  let attachmentId: string;

  describe('/task-attachments/upload/:taskId (POST)', () => {
    it('should upload an attachment to a task', () => {
      return request(app.getHttpServer())
        .post(`/api/task-attachments/upload/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', testFilePath)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.fileName).toBe('test-file.txt');
          attachmentId = res.body.id;
        });
    });
  });

  describe('/task-attachments/task/:taskId (GET)', () => {
    it('should list attachments for a task', () => {
      return request(app.getHttpServer())
        .get(`/api/task-attachments/task/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].taskId).toBe(taskId);
        });
    });
  });

  describe('/task-attachments/:id (GET)', () => {
    it('should get a specific attachment', () => {
      return request(app.getHttpServer())
        .get(`/api/task-attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(attachmentId);
        });
    });
  });

  describe('/task-attachments/:id/download (GET)', () => {
    it('should download the attachment', () => {
      return request(app.getHttpServer())
        .get(`/api/task-attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect('Content-Disposition', /attachment/);
    });
  });

  describe('/task-attachments/:id (DELETE)', () => {
    it('should delete the attachment', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should return 404 for deleted attachment', () => {
      return request(app.getHttpServer())
        .get(`/api/task-attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
