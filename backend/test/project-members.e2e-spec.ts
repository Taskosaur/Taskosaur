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
  let ownerAccessToken: string;
  let memberAccessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let membershipId: string;

  const password = 'StrongPassword123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create owner via registration API
    const ownerReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `pm-owner-${Date.now()}@example.com`,
        password,
        firstName: 'PM',
        lastName: 'Owner',
        username: `pm_owner_${Date.now()}`,
        role: Role.OWNER,
      })
      .expect(HttpStatus.CREATED);
    
    owner = ownerReg.body.user;
    ownerAccessToken = ownerReg.body.access_token;

    // Create member user via registration API
    const memberReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `pm-member-${Date.now()}@example.com`,
        password,
        firstName: 'PM',
        lastName: 'Member',
        username: `pm_member_${Date.now()}`,
        role: Role.MEMBER,
      })
      .expect(HttpStatus.CREATED);
    
    member = memberReg.body.user;
    memberAccessToken = memberReg.body.access_token;

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
        .set('Authorization', `Bearer ${ownerAccessToken}`)
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
        .set('Authorization', `Bearer ${ownerAccessToken}`)
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
        .set('Authorization', `Bearer ${ownerAccessToken}`)
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
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });

  describe('/project-members/workspace/:workspaceId (GET)', () => {
    it('should list all project members in a workspace', async () => {
      // First add the member back (since it was deleted in previous test)
      const createDto: CreateProjectMemberDto = {
        userId: member.id,
        projectId: projectId,
        role: Role.MEMBER,
      };
      const createRes = await request(app.getHttpServer())
        .post('/api/project-members')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(createDto);
      
      membershipId = createRes.body.id;

      return request(app.getHttpServer())
        .get(`/api/project-members/workspace/${workspaceId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          const mem = res.body.find((m: any) => m.userId === member.id);
          expect(mem).toBeDefined();
          expect(mem.user).toBeDefined();
          expect(mem.project).toBeDefined();
        });
    });
  });

  describe('/project-members/invite (POST)', () => {
    it('should invite a member by email', async () => {
      // Clean up previous membership if exists
      await prismaService.projectMember.deleteMany({
        where: { userId: member.id, projectId: projectId }
      });

      const inviteDto = {
        email: member.email,
        projectId: projectId,
        role: Role.VIEWER,
      };

      return request(app.getHttpServer())
        .post('/api/project-members/invite')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(inviteDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.userId).toBe(member.id);
          expect(res.body.role).toBe(Role.VIEWER);
        });
    });
  });

  describe('/project-members/user/:userId/projects (GET)', () => {
    it('should list all projects for a user', () => {
      return request(app.getHttpServer())
        .get(`/api/project-members/user/${member.id}/projects`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].projectId).toBe(projectId);
        });
    });
  });

  describe('/project-members/project/:projectId/stats (GET)', () => {
    it('should get project member statistics', () => {
      return request(app.getHttpServer())
        .get(`/api/project-members/project/${projectId}/stats`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalMembers');
          expect(res.body).toHaveProperty('roleDistribution');
          expect(res.body).toHaveProperty('recentJoins');
          expect(res.body.totalMembers).toBeGreaterThan(0);
        });
    });
  });

  describe('/project-members (POST) - Role Escalation Protection', () => {
    let managerUser: any;
    let managerAccessToken: string;

    beforeAll(async () => {
      // Create a user to be the manager
      const managerReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `pm-manager-${Date.now()}@example.com`,
          password,
          firstName: 'PM',
          lastName: 'Manager',
          username: `pm_manager_${Date.now()}`,
          role: Role.MEMBER,
        });
      managerUser = managerReg.body.user;
      managerAccessToken = managerReg.body.access_token;

      // Add them to the workspace
      await prismaService.workspaceMember.create({
        data: { userId: managerUser.id, workspaceId, role: Role.MEMBER }
      });

      // Add them to the project as MANAGER
      await prismaService.projectMember.create({
        data: { userId: managerUser.id, projectId, role: Role.MANAGER }
      });
    });

    it('should fail if a manager tries to add someone with the OWNER role', () => {
      const createDto: CreateProjectMemberDto = {
        userId: member.id,
        projectId: projectId,
        role: Role.OWNER,
      };

      return request(app.getHttpServer())
        .post('/api/project-members')
        .set('Authorization', `Bearer ${managerAccessToken}`)
        .send(createDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should fail if a manager tries to promote someone to the OWNER role via update', async () => {
      // First ensure the member is in the project
      const memberMembership = await prismaService.projectMember.upsert({
        where: { userId_projectId: { userId: member.id, projectId } },
        update: { role: Role.MEMBER },
        create: { userId: member.id, projectId, role: Role.MEMBER }
      });

      return request(app.getHttpServer())
        .patch(`/api/project-members/${memberMembership.id}`)
        .set('Authorization', `Bearer ${managerAccessToken}`)
        .send({ role: Role.OWNER })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/project-members/invite (POST) - Email Harvesting Mitigation', () => {
    it('should return generic "User not found" for unregistered email', () => {
      const inviteDto = {
        email: 'nonexistent-user-12345@example.com',
        projectId: projectId,
        role: Role.VIEWER,
      };

      return request(app.getHttpServer())
        .post('/api/project-members/invite')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(inviteDto)
        .expect(HttpStatus.NOT_FOUND)
        .expect((res) => {
          expect(res.body.message).toBe('User not found');
        });
    });
  });

  describe('Project Visibility Access', () => {
    let workspaceMember: any;
    let wsMemberAccessToken: string;
    let internalProjectId: string;

    beforeAll(async () => {
      // Create a user who is only a workspace member
      const wsMemberReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `ws-only-member-${Date.now()}@example.com`,
          password,
          firstName: 'WS',
          lastName: 'Only',
          username: `ws_only_${Date.now()}`,
          role: Role.MEMBER,
        });
      workspaceMember = wsMemberReg.body.user;
      wsMemberAccessToken = wsMemberReg.body.access_token;

      await prismaService.workspaceMember.create({
        data: { userId: workspaceMember.id, workspaceId, role: Role.MEMBER }
      });

      // Create an INTERNAL project
      const internalProject = await prismaService.project.create({
        data: {
          name: 'Internal Project',
          slug: `internal-project-${Date.now()}`,
          workspaceId,
          status: ProjectStatus.PLANNING,
          priority: ProjectPriority.MEDIUM,
          visibility: ProjectVisibility.INTERNAL,
          createdBy: owner.id,
          workflowId,
          color: '#00FF00',
        },
      });
      internalProjectId = internalProject.id;
    });

    it('should allow a workspace member to see project members for an INTERNAL project', () => {
      return request(app.getHttpServer())
        .get('/api/project-members')
        .query({ projectId: internalProjectId })
        .set('Authorization', `Bearer ${wsMemberAccessToken}`)
        .expect(HttpStatus.OK);
    });

    it('should deny a workspace member access if project visibility is PRIVATE', async () => {
      await prismaService.project.update({
        where: { id: internalProjectId },
        data: { visibility: ProjectVisibility.PRIVATE }
      });

      return request(app.getHttpServer())
        .get('/api/project-members')
        .query({ projectId: internalProjectId })
        .set('Authorization', `Bearer ${wsMemberAccessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/project-members/user/:userId/project/:projectId (GET)', () => {
    it('should allow a member to see their own membership', () => {
      return request(app.getHttpServer())
        .get(`/api/project-members/user/${member.id}/project/${projectId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.userId).toBe(member.id);
          expect(res.body.projectId).toBe(projectId);
        });
    });

    it('should allow an owner to see someone else\'s membership', () => {
      return request(app.getHttpServer())
        .get(`/api/project-members/user/${member.id}/project/${projectId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.OK);
    });

    it('should deny a stranger access to see a membership', async () => {
      // Create a stranger user
      const strangerReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `pm-stranger-${Date.now()}@example.com`,
          password,
          firstName: 'PM',
          lastName: 'Stranger',
          username: `pm_stranger_${Date.now()}`,
          role: Role.MEMBER,
        });
      const strangerAccessToken = strangerReg.body.access_token;

      return request(app.getHttpServer())
        .get(`/api/project-members/user/${member.id}/project/${projectId}`)
        .set('Authorization', `Bearer ${strangerAccessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
