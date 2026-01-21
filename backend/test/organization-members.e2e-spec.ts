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
    ownerAccessToken = jwtService.sign({ sub: ownerUser.id, email: ownerUser.email, role: ownerUser.role });
    memberAccessToken = jwtService.sign({ sub: memberUser.id, email: memberUser.email, role: memberUser.role });

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
      await prismaService.user.delete({ where: { id: ownerUser.id } });
      await prismaService.user.delete({ where: { id: memberUser.id } });
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
});