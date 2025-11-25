import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { CreateTaskStatusDto } from './../src/modules/task-statuses/dto/create-task-status.dto';

describe('TaskStatusesController (e2e)', () => {
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
        email: `status-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Status',
        lastName: 'Tester',
        username: `status_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Status Org ${Date.now()}`,
            slug: `status-org-${Date.now()}`,
            ownerId: user.id,
        }
    });
    organizationId = organization.id;

    // Create Workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: 'Status Workflow',
        organizationId: organization.id,
        isDefault: true,
      },
    });
    workflowId = workflow.id;

    // Create Workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Status Workspace ${Date.now()}`,
        slug: `status-workspace-${Date.now()}`,
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
        name: 'Status Project',
        slug: `status-project-${Date.now()}`,
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
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.taskStatus.deleteMany({ where: { workflowId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/task-statuses (POST)', () => {
    it('should create a task status', () => {
      const createDto: CreateTaskStatusDto = {
        name: 'New Status',
        color: '#0000ff',
        category: 'TODO',
        workflowId: workflowId,
        position: 1,
      };

      return request(app.getHttpServer())
        .post('/api/task-statuses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createDto.name);
          expect(res.body.workflowId).toBe(workflowId);
          statusId = res.body.id;
        });
    });
  });

  describe('/task-statuses (GET)', () => {
    it('should list task statuses', () => {
      return request(app.getHttpServer())
        .get('/api/task-statuses')
        .query({ workflowId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const status = res.body.find((s: any) => s.id === statusId);
          expect(status).toBeDefined();
        });
    });
  });

  describe('/task-statuses/:id (PATCH)', () => {
    it('should update a task status', () => {
      const updateDto = { name: 'Updated Status' };
      return request(app.getHttpServer())
        .patch(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.name).toBe(updateDto.name);
        });
    });
  });

  describe('/task-statuses/:id (DELETE)', () => {
    it('should delete a task status', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });
  });
});
