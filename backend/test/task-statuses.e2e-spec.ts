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

  describe('/task-statuses/from-project (POST)', () => {
    it('should create a task status from project', () => {
      const createDto = {
        name: 'Project Status',
        projectId: projectId,
      };

      return request(app.getHttpServer())
        .post('/api/task-statuses/from-project')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createDto.name);
          expect(res.body.workflowId).toBe(workflowId);
        });
    });
  });

  describe('/task-statuses/project (GET)', () => {
    it('should get task statuses by project id', () => {
      return request(app.getHttpServer())
        .get('/api/task-statuses/project')
        .query({ projectId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const status = res.body.find((s: any) => s.id === statusId);
          expect(status).toBeDefined();
        });
    });
  });

  describe('/task-statuses (GET) - Organization', () => {
    it('should list task statuses by organization', () => {
      return request(app.getHttpServer())
        .get('/api/task-statuses')
        .query({ organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/task-statuses/positions (PATCH)', () => {
    let secondStatusId: string;

    beforeAll(async () => {
      const secondStatus = await prismaService.taskStatus.create({
        data: {
          name: 'Second Status',
          color: '#00ff00',
          position: 2,
          workflowId: workflowId,
          category: 'TODO',
        },
      });
      secondStatusId = secondStatus.id;
    });

    afterAll(async () => {
        await prismaService.taskStatus.deleteMany({ where: { id: secondStatusId }});
    });

    it('should update task status positions', () => {
      const updatePositionsDto = {
        statusUpdates: [
          { id: statusId, position: 2 },
          { id: secondStatusId, position: 1 },
        ],
      };

      return request(app.getHttpServer())
        .patch('/api/task-statuses/positions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatePositionsDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const updatedFirst = res.body.find((s: any) => s.id === statusId);
          const updatedSecond = res.body.find((s: any) => s.id === secondStatusId);
          expect(updatedFirst.position).toBe(2);
          expect(updatedSecond.position).toBe(1);
        });
    });
  });

  describe('/task-statuses (Conflict)', () => {
    it('should fail to create a duplicate status name', () => {
        const createDto: CreateTaskStatusDto = {
            name: 'New Status', // Same name as created in first test
            color: '#0000ff',
            category: 'TODO',
            workflowId: workflowId,
            position: 99,
          };
    
          return request(app.getHttpServer())
            .post('/api/task-statuses')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(createDto)
            .expect(HttpStatus.CONFLICT);
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

  describe('/task-statuses Lifecycle (Delete & Restore)', () => {
    it('should soft delete a task status', () => {
      return request(app.getHttpServer())
        .delete(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });

    it('should find deleted task status', () => {
      return request(app.getHttpServer())
        .get('/api/task-statuses/deleted')
        .query({ workflowId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const deleted = res.body.find((s: any) => s.id === statusId);
          expect(deleted).toBeDefined();
        });
    });

    it('should restore a task status', () => {
      return request(app.getHttpServer())
        .patch(`/api/task-statuses/${statusId}/restore`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
            expect(res.body.deletedAt).toBeNull();
        });
    });

    it('should find restored task status in normal list', () => {
        return request(app.getHttpServer())
          .get('/api/task-statuses')
          .query({ workflowId })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK)
          .expect((res) => {
            const restored = res.body.find((s: any) => s.id === statusId);
            expect(restored).toBeDefined();
          });
      });
  });
});
