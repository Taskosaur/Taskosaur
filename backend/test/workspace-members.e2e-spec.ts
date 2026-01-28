import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { CreateWorkspaceMemberDto, InviteWorkspaceMemberDto } from './../src/modules/workspace-members/dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './../src/modules/workspace-members/dto/update-workspace-member.dto';

describe('WorkspaceMembersController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let ownerUser: any;
  let memberUser: any;
  let strangerUser: any;
  let ownerAccessToken: string;
  let memberAccessToken: string;
  let strangerAccessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let workspaceMemberId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create Users
    ownerUser = await prismaService.user.create({
      data: {
        email: `ws-owner-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'WS',
        lastName: 'Owner',
        username: `ws_owner_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    memberUser = await prismaService.user.create({
      data: {
        email: `ws-member-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'WS',
        lastName: 'Member',
        username: `ws_member_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    strangerUser = await prismaService.user.create({
      data: {
        email: `ws-stranger-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'WS',
        lastName: 'Stranger',
        username: `ws_stranger_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate tokens
    ownerAccessToken = jwtService.sign({ sub: ownerUser.id, email: ownerUser.email, role: ownerUser.role });
    memberAccessToken = jwtService.sign({ sub: memberUser.id, email: memberUser.email, role: memberUser.role });
    strangerAccessToken = jwtService.sign({ sub: strangerUser.id, email: strangerUser.email, role: strangerUser.role });

    // Create Organization
    const org = await prismaService.organization.create({
      data: {
        name: 'WS Test Organization',
        slug: `ws-test-org-${Date.now()}`,
        ownerId: ownerUser.id,
      },
    });
    organizationId = org.id;

    // Add users to Organization (required for Workspace membership)
    await prismaService.organizationMember.createMany({
      data: [
        { userId: ownerUser.id, organizationId, role: Role.OWNER },
        { userId: memberUser.id, organizationId, role: Role.MEMBER },
      ],
    });

    // Create Workspace
    const ws = await prismaService.workspace.create({
      data: {
        name: 'WS Test Workspace',
        slug: `ws-test-slug-${Date.now()}`,
        organizationId,
        createdBy: ownerUser.id,
      },
    });
    workspaceId = ws.id;

    // Add owner as WorkspaceMember
    await prismaService.workspaceMember.create({
      data: {
        userId: ownerUser.id,
        workspaceId,
        role: Role.OWNER,
      },
    });
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup in reverse order of dependencies
      await prismaService.workspaceMember.deleteMany({ where: { workspaceId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.organizationMember.deleteMany({ where: { organizationId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.deleteMany({ where: { id: { in: [ownerUser.id, memberUser.id, strangerUser.id] } } });
    }
    await app.close();
  });

  describe('/workspace-members (POST)', () => {
    it('should add a member to the workspace', () => {
      const createDto: CreateWorkspaceMemberDto = {
        userId: memberUser.id,
        workspaceId,
        role: Role.MEMBER,
      };

      return request(app.getHttpServer())
        .post('/api/workspace-members')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.userId).toBe(memberUser.id);
          expect(res.body.workspaceId).toBe(workspaceId);
          workspaceMemberId = res.body.id;
        });
    });

    it('should fail if actor is not manager/owner', () => {
      const createDto: CreateWorkspaceMemberDto = {
        userId: memberUser.id, // Trying to add someone else
        workspaceId,
        role: Role.MEMBER,
      };

      return request(app.getHttpServer())
        .post('/api/workspace-members')
        .set('Authorization', `Bearer ${strangerAccessToken}`)
        .send(createDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/workspace-members/invite (POST)', () => {
    it('should invite a member by email', async () => {
      // Create another user for invitation
      const invitee = await prismaService.user.create({
        data: {
          email: `ws-invitee-${Date.now()}@example.com`,
          password: 'StrongPassword123!',
          firstName: 'WS',
          lastName: 'Invitee',
          username: `ws_invitee_${Date.now()}`,
          role: Role.MEMBER,
        },
      });
      
      // Must be in org first
      await prismaService.organizationMember.create({
        data: { userId: invitee.id, organizationId, role: Role.MEMBER }
      });

      const inviteDto: InviteWorkspaceMemberDto = {
        email: invitee.email,
        workspaceId,
        role: Role.MEMBER,
      };

      return request(app.getHttpServer())
        .post('/api/workspace-members/invite')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(inviteDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.userId).toBe(invitee.id);
        });
    });
  });

  describe('/workspace-members (GET)', () => {
    it('should list workspace members for members', () => {
      return request(app.getHttpServer())
        .get(`/api/workspace-members?workspaceId=${workspaceId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeGreaterThanOrEqual(2);
        });
    });

    it('should fail for non-members', () => {
      return request(app.getHttpServer())
        .get(`/api/workspace-members?workspaceId=${workspaceId}`)
        .set('Authorization', `Bearer ${strangerAccessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/workspace-members/user/:userId/workspaces (GET)', () => {
    it('should get workspaces for the current user', () => {
      return request(app.getHttpServer())
        .get(`/api/workspace-members/user/${memberUser.id}/workspaces`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.some((m: any) => m.workspaceId === workspaceId)).toBe(true);
        });
    });

    it('should fail when viewing someone else\'s workspaces', () => {
      return request(app.getHttpServer())
        .get(`/api/workspace-members/user/${ownerUser.id}/workspaces`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('/workspace-members/workspace/:workspaceId/stats (GET)', () => {
    it('should get stats for workspace', () => {
      return request(app.getHttpServer())
        .get(`/api/workspace-members/workspace/${workspaceId}/stats`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalMembers');
          expect(res.body.totalMembers).toBeGreaterThanOrEqual(2);
        });
    });
  });

  describe('/workspace-members/:id (GET)', () => {
    it('should get one member', () => {
      return request(app.getHttpServer())
        .get(`/api/workspace-members/${workspaceMemberId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(workspaceMemberId);
        });
    });
  });

  describe('/workspace-members/:id (PATCH)', () => {
    it('should update member role by owner', () => {
      const updateDto: UpdateWorkspaceMemberDto = {
        role: Role.MANAGER,
      };

      return request(app.getHttpServer())
        .patch(`/api/workspace-members/${workspaceMemberId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.role).toBe(Role.MANAGER);
        });
    });

    it('should fail to update role by regular member', () => {
      const updateDto: UpdateWorkspaceMemberDto = {
        role: Role.OWNER,
      };

      return request(app.getHttpServer())
        .patch(`/api/workspace-members/${workspaceMemberId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send(updateDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should fail to update role by stranger', () => {
        const updateDto: UpdateWorkspaceMemberDto = {
          role: Role.OWNER,
        };
  
        return request(app.getHttpServer())
          .patch(`/api/workspace-members/${workspaceMemberId}`)
          .set('Authorization', `Bearer ${strangerAccessToken}`)
          .send(updateDto)
          .expect(HttpStatus.FORBIDDEN);
      });
  });

  describe('/workspace-members/:id (DELETE)', () => {
    it('should fail to remove by stranger', () => {
      return request(app.getHttpServer())
        .delete(`/api/workspace-members/${workspaceMemberId}`)
        .set('Authorization', `Bearer ${strangerAccessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should remove member by owner', () => {
      return request(app.getHttpServer())
        .delete(`/api/workspace-members/${workspaceMemberId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should verify member is removed', () => {
      return request(app.getHttpServer())
        .get(`/api/workspace-members/${workspaceMemberId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
