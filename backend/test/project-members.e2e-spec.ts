import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';
import { CreateProjectMemberDto } from './../src/modules/project-members/dto/create-project-member.dto';

describe('ProjectMembersController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let owner: any;
  let member: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let membershipId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create owner
    owner = await prismaService.user.create({
      data: {
        email: `pm-owner-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'PM',
        lastName: 'Owner',
        username: `pm_owner_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Create member user
    member = await prismaService.user.create({
      data: {
        email: `pm-member-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'PM',
        lastName: 'Member',
        username: `pm_member_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate token for owner
    const payload = { sub: owner.id, email: owner.email, role: owner.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `PM Org ${Date.now()}`,
            slug: `pm-org-${Date.now()}`,
            ownerId: owner.id,
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
        name: `PM Workspace ${Date.now()}`,
        slug: `pm-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Add owner to workspace
    await prismaService.workspaceMember.create({
      data: {
        userId: owner.id,
        workspaceId: workspace.id,
        role: Role.OWNER,
      },
    });

    // Add member to workspace (usually required before adding to project)
    await prismaService.workspaceMember.create({
      data: {
        userId: member.id,
        workspaceId: workspace.id,
        role: Role.MEMBER,
      },
    });

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'PM Project',
        slug: `pm-project-${Date.now()}`,
        workspaceId: workspace.id,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: owner.id,
        workflowId: workflow.id,
        color: '#000000',
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.projectMember.deleteMany({ where: { projectId } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: owner.id } });
      await prismaService.user.delete({ where: { id: member.id } });
    }
    await app.close();
  });

  describe('/project-members (POST)', () => {
    it('should add a member to the project', () => {
      const createDto: CreateProjectMemberDto = {
        userId: member.id,
        projectId: projectId,
        role: Role.MEMBER,
      };

      return request(app.getHttpServer())
        .post('/api/project-members')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.userId).toBe(member.id);
          expect(res.body.projectId).toBe(projectId);
          membershipId = res.body.id;
        });
    });
  });

  describe('/project-members (GET)', () => {
    it('should list project members', () => {
      return request(app.getHttpServer())
        .get('/api/project-members')
        .query({ projectId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          const mem = res.body.data.find((m: any) => m.id === membershipId);
          expect(mem).toBeDefined();
        });
    });
  });

  describe('/project-members/:id (PATCH)', () => {
    it('should update a member role', () => {
      const updateDto = { role: Role.MANAGER };
      return request(app.getHttpServer())
        .patch(`/api/project-members/${membershipId}`)
        .query({ requestUserId: owner.id }) // Passing requestUserId as per controller requirement
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.role).toBe(Role.MANAGER);
        });
    });
  });

  describe('/project-members/:id (DELETE)', () => {
    it('should remove a member from the project', () => {
      return request(app.getHttpServer())
        .delete(`/api/project-members/${membershipId}`)
        .query({ requestUserId: owner.id }) // Passing requestUserId as per controller requirement
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
