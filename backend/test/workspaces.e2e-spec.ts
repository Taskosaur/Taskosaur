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
        }
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
  },10000);

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.workspace.deleteMany({ where: { organizationId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.deleteMany({ where: { id: { in: [user.id, user2.id] } } });
    }
    await app.close();
  },10000);

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
  });

  describe('Charts & Analytics', () => {
    it('should get workspace charts', () => {
      // Use the workspace created in the POST test (workspaceId is set there)
      // We need to fetch the slug again because createDto.slug might have been modified 
      // if we ran the conflict test first, but here we assume sequential execution.
      // Ideally, we should fetch the workspace by ID to get the correct slug.
      
      return request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .then((wsRes) => {
            const currentSlug = wsRes.body.slug;
            return request(app.getHttpServer())
                .get(`/api/workspaces/organization/${organizationId}/workspace/${currentSlug}/charts`)
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
