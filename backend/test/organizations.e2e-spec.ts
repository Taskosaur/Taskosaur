import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { CreateOrganizationDto } from './../src/modules/organizations/dto/create-organization.dto';
import { UpdateOrganizationDto } from './../src/modules/organizations/dto/update-organization.dto';

describe('OrganizationsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let organizationId: string;
  let organizationSlug: string;

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
        email: `org-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Org',
        lastName: 'Tester',
        username: `org_tester_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.organization.deleteMany({ where: { ownerId: user.id } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/organizations (POST)', () => {
    it('should create an organization', () => {
      const createDto: CreateOrganizationDto = {
        name: 'E2E Organization',
        ownerId: user.id,
        description: 'Test Description',
      };

      return request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createDto.name);
          expect(res.body).toHaveProperty('slug');
          organizationId = res.body.id;
          organizationSlug = res.body.slug;
        });
    });
  });

  describe('/organizations (GET)', () => {
    it('should list organizations', () => {
      return request(app.getHttpServer())
        .get('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const org = res.body.find((o: any) => o.id === organizationId);
          expect(org).toBeDefined();
        });
    });
  });

  describe('/organizations/:id (GET)', () => {
    it('should get an organization by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(organizationId);
          expect(res.body.name).toBe('E2E Organization');
        });
    });
  });

  describe('/organizations/slug/:slug (GET)', () => {
    it('should get an organization by slug', () => {
      return request(app.getHttpServer())
        .get(`/api/organizations/slug/${organizationSlug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(organizationId);
          expect(res.body.slug).toBe(organizationSlug);
        });
    });
  });

  describe('/organizations/:id/stats (GET)', () => {
    it('should get organization statistics', () => {
      return request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/stats`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('statistics');
          expect(res.body).toHaveProperty('recentActivities');
          expect(res.body.organizationId).toBe(organizationId);
        });
    });
  });

  describe('/organizations/:id (PATCH)', () => {
    it('should update an organization', () => {
      const updateDto: UpdateOrganizationDto = { name: 'Updated Organization' };
      return request(app.getHttpServer())
        .patch(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.name).toBe(updateDto.name);
        });
    });
  });

  describe('/organizations/archive/:id (PATCH)', () => {
    it('should archive an organization', () => {
      return request(app.getHttpServer())
        .patch(`/api/organizations/archive/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should not list archived organizations', () => {
      return request(app.getHttpServer())
        .get('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const org = res.body.find((o: any) => o.id === organizationId);
          expect(org).toBeUndefined();
        });
    });
  });

  describe('/organizations/:id (DELETE)', () => {
    it('should delete an organization', () => {
      return request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });
  });
});