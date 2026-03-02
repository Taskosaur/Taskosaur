import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { CreateWorkspaceDto } from './../src/modules/workspaces/dto/create-workspace.dto';

describe('WorkspacesController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let user2: any;
  let accessToken: string;
  let memberAccessToken: string;
  let organizationId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create a test user (OWNER)
    user = await prismaService.user.create({
      data: {
        email: `workspace-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Workspace',
        lastName: 'Tester',
        username: `workspace_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Create a second test user (MEMBER)
    user2 = await prismaService.user.create({
      data: {
        email: `workspace-mem-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Workspace',
        lastName: 'Member',
        username: `workspace_mem_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate tokens
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    const memberPayload = { sub: user2.id, email: user2.email, role: user2.role };
    memberAccessToken = jwtService.sign(memberPayload);

    // Create Organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Workspace Org ${Date.now()}`,
        slug: `workspace-org-${Date.now()}`,
        ownerId: user.id,
      },
    });
    organizationId = organization.id;

    // Add user as Organization Member (OWNER)
    await prismaService.organizationMember.create({
      data: {
        organizationId: organizationId,
        userId: user.id,
        role: Role.OWNER,
      },
    });

    // Add user2 as Organization Member (MEMBER)
    await prismaService.organizationMember.create({
      data: {
        organizationId: organizationId,
        userId: user2.id,
        role: Role.MEMBER,
      },
    });
  }, 10000);

  afterAll(async () => {
    if (prismaService) {
      // Cleanup - get all orgs created in this test to clean up their workspaces
      const testOrgs = await prismaService.organization.findMany({
        where: {
          OR: [{ id: organizationId }, { name: 'Org 2' }],
        },
        select: { id: true },
      });
      const orgIds = testOrgs.map((o) => o.id);

      await prismaService.workspace.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prismaService.organization.deleteMany({
        where: { id: { in: orgIds } },
      });
      await prismaService.user.deleteMany({ where: { id: { in: [user.id, user2.id] } } });
    }
    await app.close();
  }, 10000);

  const createDto: CreateWorkspaceDto = {
    name: 'E2E Workspace',
    slug: `e2e-workspace-${Date.now()}`,
    organizationId: '', // Will be set in test
  };

  describe('/workspaces (POST)', () => {
    it('should create a workspace', () => {
      createDto.organizationId = organizationId;

      return request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createDto.name);
          expect(res.body.slug).toBe(createDto.slug);
          workspaceId = res.body.id;
        });
    });

    it('should handle slug collision by appending counter', () => {
      return request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.slug).not.toBe(createDto.slug);
          expect(res.body.slug).toMatch(new RegExp(`^${createDto.slug}-\\d+$`));
        });
    });

    it('should prevent a non-elevated user (MEMBER) from creating a workspace', () => {
      return request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ ...createDto, name: 'Member Workspace', slug: 'member-ws' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should automatically add organization members to the new workspace', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...createDto,
          name: 'Inheritance Test',
          slug: `inheritance-test-${Date.now()}`,
        });

      const newWorkspaceId = res.body.id;
      const members = await prismaService.workspaceMember.findMany({
        where: { workspaceId: newWorkspaceId },
      });

      // Verify at least the creator and org member are added
      expect(members.some((m) => m.userId === user.id)).toBe(true);
      expect(members.some((m) => m.userId === user2.id)).toBe(true);
    });

    it('should allow identical slugs in different organizations', async () => {
      // Create a second organization
      const org2 = await prismaService.organization.create({
        data: {
          name: 'Org 2',
          slug: `org-2-${Date.now()}`,
          ownerId: user.id,
        },
      });

      // MUST add user as Org 2 Member (OWNER) to have permission to create workspace there
      await prismaService.organizationMember.create({
        data: {
          organizationId: org2.id,
          userId: user.id,
          role: Role.OWNER,
        },
      });

      const sharedSlug = `shared-slug-${Date.now()}`;

      // Create in Org 1
      await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...createDto, organizationId, slug: sharedSlug })
        .expect(HttpStatus.CREATED);

      // Create in Org 2 - should NOT append counter
      await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...createDto, organizationId: org2.id, slug: sharedSlug })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.slug).toBe(sharedSlug);
        });
    });
  });

  describe('/workspaces (GET)', () => {
    it('should list workspaces', () => {
      return request(app.getHttpServer())
        .get('/api/workspaces')
        .query({ organizationId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const workspace = res.body.find((w: any) => w.id === workspaceId);
          expect(workspace).toBeDefined();
        });
    });
  });

  describe('/workspaces/search/paginated (GET)', () => {
    it('should return paginated workspaces', () => {
      return request(app.getHttpServer())
        .get('/api/workspaces/search/paginated')
        .query({ organizationId, page: 1, limit: 1 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('workspaces');
          expect(res.body).toHaveProperty('pagination');
          expect(res.body.workspaces.length).toBe(1);
          expect(res.body.pagination.totalCount).toBeGreaterThanOrEqual(1);
        });
    });
  });

  describe('/workspaces/:id (GET)', () => {
    it('should get a workspace', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(workspaceId);
          expect(res.body.name).toBe('E2E Workspace');
        });
    });
  });

  describe('Access Control', () => {
    it('should prevent access to workspace via slug without membership', async () => {
      // Create a user who is not a member of ANY organization or workspace
      const nonMember = await prismaService.user.create({
        data: {
          email: `non-member-${Date.now()}@example.com`,
          password: 'StrongPassword123!',
          firstName: 'Non',
          lastName: 'Member',
          username: `non_member_${Date.now()}`,
          role: Role.MEMBER,
        },
      });

      const nonMemberToken = jwtService.sign({
        sub: nonMember.id,
        email: nonMember.email,
        role: nonMember.role,
      });

      // Get workspace slug
      const ws = await prismaService.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true },
      });

      try {
        await request(app.getHttpServer())
          .get(`/api/workspaces/organization/${organizationId}/slug/${ws?.slug}`)
          .set('Authorization', `Bearer ${nonMemberToken}`)
          .expect(HttpStatus.FORBIDDEN);
      } finally {
        await prismaService.user.delete({ where: { id: nonMember.id } });
      }
    });
  });

  describe('/workspaces/:id (PATCH)', () => {
    it('should update a workspace', () => {
      const updateDto = { name: 'Updated Workspace' };
      return request(app.getHttpServer())
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.name).toBe(updateDto.name);
        });
    });

    it('should prevent updating with a duplicate slug in the same org', async () => {
      const ws2 = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...createDto, name: 'Workspace 2', slug: 'ws-2' });

      return request(app.getHttpServer())
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ slug: 'ws-2' })
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('Charts & Analytics', () => {
    it('should get workspace charts', () => {
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .then((wsRes) => {
          const currentSlug = wsRes.body.slug;
          return request(app.getHttpServer())
            .get(
              `/api/workspaces/organization/${organizationId}/workspace/${currentSlug}/charts`,
            )
            .query({ types: 'kpi-metrics' })
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(HttpStatus.OK)
            .expect((res) => {
              expect(res.body).toHaveProperty('kpi-metrics');
            });
        });
    });
  });

  describe('/workspaces/archive/:id (PATCH)', () => {
    let archiveWorkspaceId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...createDto, slug: `archive-ws-${Date.now()}` });
      archiveWorkspaceId = res.body.id;
    });

    it('should prevent non-owners from archiving', () => {
      return request(app.getHttpServer())
        .patch(`/api/workspaces/archive/${archiveWorkspaceId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should archive workspace', () => {
      return request(app.getHttpServer())
        .patch(`/api/workspaces/archive/${archiveWorkspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should verify workspace is archived', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/workspaces/${archiveWorkspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      expect(res.body.archive).toBe(true);
    });
  });

  describe('/workspaces/:id (DELETE)', () => {
    it('should prevent non-owners from deleting', () => {
      return request(app.getHttpServer())
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should delete a workspace', () => {
      return request(app.getHttpServer())
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });
  });
});
