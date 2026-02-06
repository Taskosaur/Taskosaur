import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { CreateLabelDto } from './../src/modules/labels/dto/create-label.dto';
import { UpdateLabelDto } from './../src/modules/labels/dto/update-label.dto';

describe('LabelsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;

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
        email: `label-crud-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Label',
        lastName: 'Tester',
        username: `label_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Label Org ${Date.now()}`,
            slug: `label-org-${Date.now()}`,
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
        name: `Label Workspace ${Date.now()}`,
        slug: `label-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Label Project',
        slug: `label-project-${Date.now()}`,
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
      await prismaService.label.deleteMany({ where: { projectId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  let labelId: string;

  describe('/labels (POST)', () => {
    it('should create a new label', () => {
      const createLabelDto: CreateLabelDto = {
        name: 'Urgent',
        color: '#FF0000',
        description: 'Urgent tasks',
        projectId: projectId,
      };

      return request(app.getHttpServer())
        .post('/api/labels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createLabelDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createLabelDto.name);
          expect(res.body.color).toBe(createLabelDto.color);
          labelId = res.body.id;
        });
    });
  });

  describe('/labels (GET)', () => {
    it('should list all labels for a project', () => {
      return request(app.getHttpServer())
        .get('/api/labels')
        .query({ projectId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].projectId).toBe(projectId);
        });
    });

    it('should find one label by id', () => {
      return request(app.getHttpServer())
        .get(`/api/labels/${labelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(labelId);
          expect(res.body.name).toBe('Urgent');
        });
    });
  });

  describe('/labels/:id (PATCH)', () => {
    it('should update a label', () => {
      const updateLabelDto: UpdateLabelDto = {
        name: 'Extremely Urgent',
        color: '#8B0000',
      };

      return request(app.getHttpServer())
        .patch(`/api/labels/${labelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateLabelDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.name).toBe(updateLabelDto.name);
          expect(res.body.color).toBe(updateLabelDto.color);
        });
    });
  });

  describe('/labels/:id (DELETE)', () => {
    it('should delete a label', () => {
      return request(app.getHttpServer())
        .delete(`/api/labels/${labelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should return 404 when getting deleted label', () => {
      return request(app.getHttpServer())
        .get(`/api/labels/${labelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
