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
  let accessToken: string;
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

    // Create a test user
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

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
        data: {
            name: `Workspace Org ${Date.now()}`,
            slug: `workspace-org-${Date.now()}`,
            ownerId: user.id,
        }
    });
    organizationId = organization.id;
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.workspace.deleteMany({ where: { organizationId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  describe('/workspaces (POST)', () => {
    it('should create a workspace', () => {
      const createDto: CreateWorkspaceDto = {
        name: 'E2E Workspace',
        slug: `e2e-workspace-${Date.now()}`,
        organizationId: organizationId,
      };

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

  describe('/workspaces/:id (DELETE)', () => {
    it('should delete a workspace', () => {
      return request(app.getHttpServer())
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });
  });
});
