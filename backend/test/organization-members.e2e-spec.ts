import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { CreateOrganizationMemberDto } from './../src/modules/organization-members/dto/create-organization-member.dto';
import { UpdateOrganizationMemberDto } from './../src/modules/organization-members/dto/update-organization-member.dto';
import { Role as OrganizationRole } from '@prisma/client';

describe('OrganizationMembersController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let ownerUser: any;
  let memberUser: any;
  let ownerAccessToken: string;
  let memberAccessToken: string;
  let organizationId: string;
  let organizationSlug: string;
  let memberId: string; // The ID of the OrganizationMember record

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create Owner User
    ownerUser = await prismaService.user.create({
      data: {
        email: `org-owner-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Org',
        lastName: 'Owner',
        username: `org_owner_${Date.now()}`,
        role: Role.MEMBER, // Regular user who owns an org
      },
    });

    // Create Member User (to be added)
    memberUser = await prismaService.user.create({
      data: {
        email: `org-member-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Org',
        lastName: 'Member',
        username: `org_member_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate tokens
    ownerAccessToken = jwtService.sign({
      sub: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });
    memberAccessToken = jwtService.sign({
      sub: memberUser.id,
      email: memberUser.email,
      role: memberUser.role,
    });

    // Create Organization
    const org = await prismaService.organization.create({
      data: {
        name: 'Member Test Organization',
        slug: `member-test-org-${Date.now()}`,
        ownerId: ownerUser.id,
      },
    });
    organizationId = org.id;
    organizationSlug = org.slug;

    // Add owner as OrganizationMember
    await prismaService.organizationMember.create({
      data: {
        userId: ownerUser.id,
        organizationId: org.id,
        role: OrganizationRole.OWNER,
      },
    });
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.organizationMember.deleteMany({ where: { organizationId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.deleteMany({
        where: { id: { in: [ownerUser.id, memberUser.id] } },
      });
    }
    await app.close();
  });

  describe('/organization-members (POST)', () => {
    it('should add a member to the organization', () => {
      const createDto: CreateOrganizationMemberDto = {
        userId: memberUser.id,
        organizationId: organizationId,
        role: OrganizationRole.MEMBER,
      };

      return request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.userId).toBe(memberUser.id);
          expect(res.body.role).toBe(OrganizationRole.MEMBER);
          memberId = res.body.id;
        });
    });

    it('should fail to add the same member again', () => {
      const createDto: CreateOrganizationMemberDto = {
        userId: memberUser.id,
        organizationId: organizationId,
        role: OrganizationRole.MEMBER,
      };

      return request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(createDto)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('/organization-members (GET)', () => {
    it('should list organization members', () => {
      return request(app.getHttpServer())
        .get(`/api/organization-members?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // Should have at least owner and member
          expect(res.body.length).toBeGreaterThanOrEqual(2);
          const member = res.body.find((m: any) => m.id === memberId);
          expect(member).toBeDefined();
        });
    });
  });

  describe('/organization-members/slug (GET)', () => {
    it('should list organization members by slug', () => {
      return request(app.getHttpServer())
        .get(`/api/organization-members/slug?slug=${organizationSlug}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeGreaterThanOrEqual(2);
        });
    });
  });

  describe('/organization-members/:id (PATCH)', () => {
    it('should update member role', () => {
      const updateDto: UpdateOrganizationMemberDto = {
        role: OrganizationRole.MANAGER,
        isDefault: false,
      };

      return request(app.getHttpServer())
        .patch(`/api/organization-members/${memberId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(memberId);
          expect(res.body.role).toBe(OrganizationRole.MANAGER);
        });
    });
  });

  describe('/organization-members/user/:userId/organizations (GET)', () => {
    it('should get user organizations', () => {
      return request(app.getHttpServer())
        .get(`/api/organization-members/user/${memberUser.id}/organizations`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const org = res.body.find((o: any) => o.id === organizationId);
          expect(org).toBeDefined();
        });
    });
  });

  describe('/organization-members/:id (DELETE)', () => {
    it('should remove a member from the organization', () => {
      return request(app.getHttpServer())
        .delete(`/api/organization-members/${memberId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should verify member is removed', () => {
      return request(app.getHttpServer())
        .get(`/api/organization-members?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const member = res.body.find((m: any) => m.id === memberId);
          expect(member).toBeUndefined();
        });
    });
  });

  describe('Organization Members - Security and Logic', () => {
    let managerUser: any;
    let managerAccessToken: string;

    beforeAll(async () => {
      // Create a manager user
      managerUser = await prismaService.user.create({
        data: {
          email: `org-manager-${Date.now()}@example.com`,
          password: 'StrongPassword123!',
          firstName: 'Org',
          lastName: 'Manager',
          username: `org_manager_${Date.now()}`,
          role: Role.MEMBER,
        },
      });

      await prismaService.organizationMember.create({
        data: {
          userId: managerUser.id,
          organizationId,
          role: OrganizationRole.MANAGER,
        },
      });

      managerAccessToken = jwtService.sign({
        sub: managerUser.id,
        email: managerUser.email,
        role: managerUser.role,
      });
    });

    afterAll(async () => {
      await prismaService.user.delete({ where: { id: managerUser.id } });
    });

    it('should fail if a manager tries to add an OWNER', async () => {
      const newUser = await prismaService.user.create({
        data: {
          email: `org-new-${Date.now()}@example.com`,
          password: 'StrongPassword123!',
          firstName: 'New',
          lastName: 'User',
          username: `new_user_${Date.now()}`,
          role: Role.MEMBER,
        },
      });

      const createDto: CreateOrganizationMemberDto = {
        userId: newUser.id,
        organizationId,
        role: OrganizationRole.OWNER,
      };

      try {
        await request(app.getHttpServer())
          .post('/api/organization-members')
          .set('Authorization', `Bearer ${managerAccessToken}`)
          .send(createDto)
          .expect(HttpStatus.FORBIDDEN);
      } finally {
        await prismaService.user.delete({ where: { id: newUser.id } });
      }
    });

    it('should fail if a manager tries to promote someone to OWNER', async () => {
      // Add a regular member first
      const memberDto: CreateOrganizationMemberDto = {
        userId: memberUser.id,
        organizationId,
        role: OrganizationRole.MEMBER,
      };
      const res = await request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(memberDto);

      const newMemberId = res.body.id;

      return request(app.getHttpServer())
        .patch(`/api/organization-members/${newMemberId}`)
        .set('Authorization', `Bearer ${managerAccessToken}`)
        .send({ role: OrganizationRole.OWNER })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return generic "User not found" for unregistered email in invite', () => {
      return request(app.getHttpServer())
        .post('/api/organization-members/invite')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          email: 'nonexistent@example.com',
          organizationId,
          role: OrganizationRole.MEMBER,
        })
        .expect(HttpStatus.NOT_FOUND)
        .expect((res) => {
          expect(res.body.message).toBe('User not found');
        });
    });

    it('should automatically sync role to workspaces when promoted to MANAGER', async () => {
      // Create a workspace first
      const ws = await prismaService.workspace.create({
        data: {
          name: 'Sync Test Workspace',
          slug: `sync-ws-${Date.now()}`,
          organizationId,
        },
      });

      try {
        // User is currently a MEMBER (added in previous test)
        // Promote to MANAGER
        const orgMember = await prismaService.organizationMember.findFirst({
          where: { userId: memberUser.id, organizationId },
        });

        if (!orgMember) throw new Error('Org member not found');

        await request(app.getHttpServer())
          .patch(`/api/organization-members/${orgMember.id}`)
          .set('Authorization', `Bearer ${ownerAccessToken}`)
          .send({ role: OrganizationRole.MANAGER })
          .expect(HttpStatus.OK);

        // Verify they were added to the workspace as MANAGER
        const wsMember = await prismaService.workspaceMember.findFirst({
          where: { userId: memberUser.id, workspaceId: ws.id },
        });

        if (!wsMember) throw new Error('Workspace member not found');
        expect(wsMember.role).toBe(OrganizationRole.MANAGER);
      } finally {
        await prismaService.workspaceMember.deleteMany({ where: { workspaceId: ws.id } });
        await prismaService.workspace.delete({ where: { id: ws.id } });
      }
    });
  });
});
