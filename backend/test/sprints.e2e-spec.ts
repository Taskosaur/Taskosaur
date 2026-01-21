  import { Test, TestingModule } from '@nestjs/testing';
  import { INestApplication, HttpStatus } from '@nestjs/common';
  import * as request from 'supertest';
  import { AppModule } from './../src/app.module';
  import { PrismaService } from './../src/prisma/prisma.service';
  import { JwtService } from '@nestjs/jwt';
  import { Role, SprintStatus } from '@prisma/client';
  import { CreateSprintDto } from
  './../src/modules/sprints/dto/create-sprint.dto';
  import { UpdateSprintDto } from
  './../src/modules/sprints/dto/update-sprint.dto';
  import { CreateOrganizationDto } from
  './../src/modules/organizations/dto/create-organization.dto'; // Required for setup
  import { OrganizationsService } from
  './../src/modules/organizations/organizations.service'; // Required for setup

  describe('SprintsController (e2e)', () => {
    let app: INestApplication;
    let prismaService: PrismaService;
    let jwtService: JwtService;
    let organizationsService: OrganizationsService;

    let user: any;
    let accessToken: string;
    let organizationId: string;
    let workspaceId: string;
    let projectId: string;
    let projectSlug: string;
    let sprintId: string; // For general purpose sprint
    let planningSprintId: string;
    let activeSprintId: string;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
      prismaService = app.get<PrismaService>(PrismaService);
      jwtService = app.get<JwtService>(JwtService);
      organizationsService =
  app.get<OrganizationsService>(OrganizationsService); // Get service to create org

      // 1. Create a test user
      user = await prismaService.user.create({
        data: {
          email: `sprint-test-${Date.now()}@example.com`,
          password: 'StrongPassword123!',
          firstName: 'Sprint',
          lastName: 'Tester',
          username: `sprint_tester_${Date.now()}`,
          role: Role.OWNER,
        },
      });

      // Generate token
      const payload = { sub: user.id, email: user.email, role: user.role };
      accessToken = jwtService.sign(payload);

      // 2. Create an Organization (using service to ensure all defaults are setup)
      const createOrgDto: CreateOrganizationDto = {
        name: `Sprint Test Org ${Date.now()}`,
        ownerId: user.id,
        defaultWorkspace: { name: 'Default Workspace' },
        defaultProject: { name: 'Default Project' },
      };
      const organization = await organizationsService.create(createOrgDto,
  user.id);
      organizationId = organization.id;

      // Retrieve the created workspace and project for the organization
      const createdWorkspace = await prismaService.workspace.findFirst({
        where: { organizationId },
      });
      if (!createdWorkspace) throw new Error('Workspace not found');
      workspaceId = createdWorkspace.id;

      const createdProject = await prismaService.project.findFirst({
        where: { workspaceId },
      });
      if (!createdProject) throw new Error('Project not found');
      projectId = createdProject.id;
      projectSlug = createdProject.slug;
    });

    afterAll(async () => {
      if (prismaService) {
        // Clean up in reverse order of creation due to foreign key constraints
        await prismaService.task.deleteMany({ where: { projectId: projectId }
  });
        await prismaService.sprint.deleteMany({ where: { projectId: projectId }
  });
        await prismaService.projectMember.deleteMany({ where: { projectId:
  projectId } });
        await prismaService.project.deleteMany({ where: { id: projectId } });
        await prismaService.workspaceMember.deleteMany({ where: { workspaceId:
  workspaceId } });
        await prismaService.workspace.deleteMany({ where: { id: workspaceId }
  });
        await prismaService.organizationMember.deleteMany({ where: {
  organizationId: organizationId } });
        await prismaService.workflow.deleteMany({ where: { organizationId:
  organizationId } }); // Also deletes statuses and transitions due to cascade
        await prismaService.organization.deleteMany({ where: { id:
  organizationId } });
        await prismaService.user.delete({ where: { id: user.id } });
      }
      await app.close();
    });

    // Helper to create a new sprint for isolated tests
    const createTestSprint = async (name: string, status: SprintStatus =
  SprintStatus.PLANNING) => {
      const createDto: CreateSprintDto = {
        name,
        projectId: projectSlug,
        goal: `Goal for ${name}`,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: status,
      };

      const res = await request(app.getHttpServer())
        .post('/api/sprints')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED);

      return res.body;
    };

    describe('POST /sprints', () => {
      it('should create a sprint', async () => {
        const createDto: CreateSprintDto = {
          name: 'Test Sprint 1',
          projectId: projectSlug,
          goal: 'Complete initial features',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const res = await request(app.getHttpServer())
          .post('/api/sprints')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(createDto)
          .expect(HttpStatus.CREATED);

        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe(createDto.name);
        expect(res.body.projectId).toBe(projectId);
        expect(res.body.status).toBe(SprintStatus.PLANNING); // Default status if not provided
        sprintId = res.body.id; // Save for later tests
      });

      it('should create a planning sprint', async () => {
        const sprint = await createTestSprint('Planning Sprint',
  SprintStatus.PLANNING);
        planningSprintId = sprint.id;
        expect(sprint.status).toBe(SprintStatus.PLANNING);
      });

      it('should return 404 if project ID does not exist', () => {
        const createDto: CreateSprintDto = {
          name: 'Sprint for NonExistent Project',
          projectId: '00000000-0000-4000-8000-000000000000', // Non-existent  UUID
          goal: 'Some goal',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        return request(app.getHttpServer())
          .post('/api/sprints')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(createDto)
          .expect(HttpStatus.NOT_FOUND);
      });
    });

    describe('GET /sprints', () => {
      it('should return all non-archived sprints for the project', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/sprints?projectId=${projectId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1); // At least the default sprint created
        expect(res.body.some((s: any) => s.id === sprintId)).toBe(true);
      });

      it('should return sprints filtered by status (PLANNING)', async () => {
        const res = await request(app.getHttpServer())

  .get(`/api/sprints?projectId=${projectId}&status=${SprintStatus.PLANNING}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((s: any) => s.id === planningSprintId)).toBe(true);
        expect(res.body.every((s: any) => s.status ===
  SprintStatus.PLANNING)).toBe(true);
      });
    });

    describe('GET /sprints/slug', () => {
      it('should return sprints filtered by project slug', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/sprints/slug?slug=${projectSlug}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
        expect(res.body.every((s: any) => s.project.slug ===
  projectSlug)).toBe(true);
      });
    });

    describe('GET /sprints/:id', () => {
      it('should return a specific sprint by ID', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/sprints/${sprintId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);

        expect(res.body).toHaveProperty('id', sprintId);
        expect(res.body).toHaveProperty('name', 'Test Sprint 1');
        expect(res.body).toHaveProperty('project');
        expect(res.body.project.id).toBe(projectId);
      });

      it('should return 404 if sprint ID does not exist', () => {
        return request(app.getHttpServer())
          .get('/api/sprints/00000000-0000-4000-8000-000000000000')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.NOT_FOUND);
      });
    });

    describe('GET /sprints/project/:projectId/active', () => {
    });

    describe('PATCH /sprints/:id', () => {
      it('should update sprint details', async () => {
        const updateDto: UpdateSprintDto = { goal: 'Updated sprint goal' };
        const res = await request(app.getHttpServer())
          .patch(`/api/sprints/${sprintId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateDto)
          .expect(HttpStatus.OK);

        expect(res.body).toHaveProperty('id', sprintId);
        expect(res.body.goal).toBe(updateDto.goal);
      });

      it('should return 404 if sprint ID does not exist', () => {
        const updateDto: UpdateSprintDto = { name: 'NonExistent' };
        return request(app.getHttpServer())
          .patch('/api/sprints/00000000-0000-4000-8000-000000000000')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateDto)
          .expect(HttpStatus.NOT_FOUND);
      });
    });

    describe('PATCH /sprints/archive/:id', () => {
      let sprintToArchiveId: string;
      beforeAll(async () => {
        const sprint = await createTestSprint('Sprint to Archive',
  SprintStatus.PLANNING);
        sprintToArchiveId = sprint.id;
      });

      it('should archive a sprint', () => {
        return request(app.getHttpServer())
          .patch(`/api/sprints/archive/${sprintToArchiveId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.NO_CONTENT);
      });

      it('should not list archived sprints in findAll', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/sprints?projectId=${projectId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((s: any) => s.id ===
  sprintToArchiveId)).toBe(false);
      });

      it('should still be able to retrieve an archived sprint by ID', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/sprints/${sprintToArchiveId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.OK);
        expect(res.body).toHaveProperty('id', sprintToArchiveId);
        expect(res.body.archive).toBe(true);
      });

      it('should return 404 if sprint ID does not exist', () => {
        return request(app.getHttpServer())
          .patch('/api/sprints/archive/00000000-0000-4000-8000-000000000000')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.NOT_FOUND);
      });
    });

    describe('DELETE /sprints/:id', () => {
      let sprintToDeleteId: string;
      let activeSprintForDeleteTestId: string;

      beforeAll(async () => {
          // Create a new sprint for deletion
          const sprint = await createTestSprint('Sprint to Delete',
  SprintStatus.PLANNING);
          sprintToDeleteId = sprint.id;
      });

      it('should successfully delete a planning sprint', async () => {
        await request(app.getHttpServer())
          .delete(`/api/sprints/${sprintToDeleteId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.NO_CONTENT);

        // Verify it's no longer retrievable
        await request(app.getHttpServer())
          .get(`/api/sprints/${sprintToDeleteId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.NOT_FOUND);
      });

      it('should return 404 if sprint ID does not exist', () => {
        return request(app.getHttpServer())
          .delete('/api/sprints/00000000-0000-4000-8000-000000000000')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(HttpStatus.NOT_FOUND);
      });
    });
  });