import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { CreateProjectDto } from './../src/modules/projects/dto/create-project.dto';

describe('ProjectsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let workspaceId: string;
  let projectId: string;
  let organizationId: string;

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
        email: `proj-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Project',
        lastName: 'Manager',
        username: `proj_mgr_${Date.now()}`,
        role: Role.OWNER, // Needs to be OWNER or MANAGER to create projects
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Test Org ${Date.now()}`,
            slug: `test-org-${Date.now()}`,
            ownerId: user.id,
        }
    });
    organizationId = organization.id;

    // Create default workflow
    await prismaService.workflow.create({
      data: {
        name: 'Default Workflow',
        organizationId: organization.id,
        isDefault: true,
        statuses: {
          create: [
            { name: 'To Do', color: '#ff0000', category: 'TODO', position: 1 },
            { name: 'In Progress', color: '#ffff00', category: 'IN_PROGRESS', position: 2 },
            { name: 'Done', color: '#00ff00', category: 'DONE', position: 3 },
          ],
        },
      },
    });

    // Create a workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Test Workspace ${Date.now()}`,
        slug: `test-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;
    
    // Add user to workspace as OWNER
    await prismaService.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: Role.OWNER,
      },
    });
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.project.deleteMany({ where: { workspaceId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  const createProjectDto: CreateProjectDto = {
    name: 'E2E Test Project',
    slug: `e2e-test-project-${Date.now()}`,
    color: '#ff0000',
    avatar: 'https://example.com/avatar.png',
    workspaceId: '', // Will be set in test
    description: 'A project for E2E testing',
    status: ProjectStatus.PLANNING,
    priority: ProjectPriority.HIGH,
    visibility: ProjectVisibility.PRIVATE,
  };

  describe('/projects (POST)', () => {
    it('should create a new project', () => {
      createProjectDto.workspaceId = workspaceId;
      
      return request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createProjectDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createProjectDto.name);
          expect(res.body.slug).toBe(createProjectDto.slug);
          projectId = res.body.id;
        });
    });
  });

  describe('/projects/:id (GET)', () => {
    it('should retrieve the project', () => {
      return request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(projectId);
          expect(res.body.name).toBe(createProjectDto.name);
        });
    });
  });

  describe('/projects/:id (PATCH)', () => {
    it('should update the project', () => {
      const updateData = { name: 'Updated Project Name' };
      return request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.name).toBe(updateData.name);
        });
    });
  });

  describe('/projects (GET)', () => {
    it('should list projects in workspace', () => {
      return request(app.getHttpServer())
        .get('/api/projects')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const project = res.body.find((p: any) => p.id === projectId);
          expect(project).toBeDefined();
        });
    });
  });

  describe('/projects/:id (DELETE)', () => {
    it('should delete the project', () => {
      return request(app.getHttpServer())
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });

    it('should not find the deleted project', () => {
      return request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
