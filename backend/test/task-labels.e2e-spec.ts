import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { AssignTaskLabelDto } from './../src/modules/task-label/dto/create-task-labels.dto';

describe('TaskLabelsController (e2e)', () => {
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
  let labelId: string;

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
        email: `tlabel-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'TaskLabel',
        lastName: 'Tester',
        username: `tlabel_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `TLabel Org ${Date.now()}`,
            slug: `tlabel-org-${Date.now()}`,
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
        name: `TLabel Workspace ${Date.now()}`,
        slug: `tlabel-workspace-${Date.now()}`,
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

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'TLabel Project',
        slug: `tlabel-project-${Date.now()}`,
        workspaceId: workspace.id,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: user.id,
        workflowId: workflow.id,
        color: '#000000', // Required field
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
        title: 'Task for Labels',
        description: 'Task created by E2E test',
        projectId: projectId,
        statusId: statusId,
        priority: 'HIGH',
        type: 'TASK',
        createdBy: user.id,
        taskNumber: 1,
        slug: 'TL-1',
      },
    });
    taskId = task.id;

    // Create Label
    const label = await prismaService.label.create({
      data: {
        name: 'Test Label',
        color: '#00ff00',
        projectId: projectId,
      },
    });
    labelId = label.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.taskLabel.deleteMany({ where: { taskId } });
      await prismaService.label.delete({ where: { id: labelId } });
      await prismaService.task.delete({ where: { id: taskId } });
      await prismaService.taskStatus.delete({ where: { id: statusId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/task-labels (POST)', () => {
    it('should assign a label to a task', () => {
      const assignDto: AssignTaskLabelDto = {
        taskId: taskId,
        labelId: labelId,
        userId: user.id,
      };

      return request(app.getHttpServer())
        .post('/api/task-labels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(assignDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('taskId');
          expect(res.body.taskId).toBe(taskId);
          expect(res.body.labelId).toBe(labelId);
        });
    });
  });

  describe('/task-labels (GET)', () => {
    it('should list task labels', () => {
      return request(app.getHttpServer())
        .get('/api/task-labels')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const assignment = res.body.find((tl: any) => tl.taskId === taskId && tl.labelId === labelId);
          expect(assignment).toBeDefined();
        });
    });
  });

  describe('/task-labels/:taskId/:labelId (DELETE)', () => {
    it('should remove a label from a task', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-labels/${taskId}/${labelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
            expect(res.body.message).toBe('Label removed from task successfully');
        });
    });
  });
});
