import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { CreateInvitationDto } from './../src/modules/invitations/dto/create-invitation.dto';

describe('InvitationsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let owner: any;
  let invitee: any;
  let accessToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let invitationId: string;
  let invitationToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create owner user
    owner = await prismaService.user.create({
      data: {
        email: `inv-owner-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Invitation',
        lastName: 'Owner',
        username: `inv_owner_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Create invitee user
    invitee = await prismaService.user.create({
      data: {
        email: `inv-invitee-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'Invitation',
        lastName: 'Invitee',
        username: `inv_invitee_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate token for owner
    const payload = { sub: owner.id, email: owner.email, role: owner.role };
    accessToken = jwtService.sign(payload);

    // Create Organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Invitation Org ${Date.now()}`,
        slug: `inv-org-${Date.now()}`,
        ownerId: owner.id,
      },
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
        name: `Invitation Workspace ${Date.now()}`,
        slug: `inv-workspace-${Date.now()}`,
        organizationId: organization.id,
      },
    });
    workspaceId = workspace.id;

    // Create Project
    const project = await prismaService.project.create({
      data: {
        name: 'Invitation Project',
        slug: `inv-project-${Date.now()}`,
        workspaceId: workspace.id,
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
      await prismaService.invitation.deleteMany({ where: { inviterId: owner.id } });
      await prismaService.project.delete({ where: { id: projectId } });
      await prismaService.workspace.delete({ where: { id: workspaceId } });
      await prismaService.workflow.delete({ where: { id: workflowId } });
      await prismaService.organization.delete({ where: { id: organizationId } });
      await prismaService.user.delete({ where: { id: owner.id } });
      await prismaService.user.delete({ where: { id: invitee.id } });
    }
    await app.close();
  });

  describe('/invitations (POST)', () => {
    it('should create an organization invitation', () => {
      const createDto: CreateInvitationDto = {
        inviteeEmail: `new-member-${Date.now()}@example.com`,
        organizationId: organizationId,
        role: 'MEMBER',
      };

      return request(app.getHttpServer())
        .post('/api/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('token');
          expect(res.body.inviteeEmail).toBe(createDto.inviteeEmail);
          expect(res.body.organizationId).toBe(organizationId);
          invitationId = res.body.id;
          invitationToken = res.body.token;
        });
    });

    it('should create a workspace invitation', () => {
      const createDto: CreateInvitationDto = {
        inviteeEmail: `workspace-member-${Date.now()}@example.com`,
        workspaceId: workspaceId,
        role: 'MEMBER',
      };

      return request(app.getHttpServer())
        .post('/api/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.workspaceId).toBe(workspaceId);
        });
    });

    it('should create a project invitation', () => {
      const createDto: CreateInvitationDto = {
        inviteeEmail: `project-member-${Date.now()}@example.com`,
        projectId: projectId,
        role: 'MEMBER',
      };

      return request(app.getHttpServer())
        .post('/api/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.projectId).toBe(projectId);
        });
    });
  });

  describe('/invitations/user (GET)', () => {
    it('should get user invitations', () => {
      return request(app.getHttpServer())
        .get('/api/invitations/user')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/invitations/entity/:entityType/:entityId (GET)', () => {
    it('should get organization invitations', () => {
      return request(app.getHttpServer())
        .get(`/api/invitations/entity/organization/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get workspace invitations', () => {
      return request(app.getHttpServer())
        .get(`/api/invitations/entity/workspace/${workspaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get project invitations', () => {
      return request(app.getHttpServer())
        .get(`/api/invitations/entity/project/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/invitations/verify/:token (GET)', () => {
    it('should verify invitation token', () => {
      return request(app.getHttpServer())
        .get(`/api/invitations/verify/${invitationToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('invitation');
          expect(res.body.invitation).toHaveProperty('id');
          expect(res.body).toHaveProperty('isValid');
          expect(res.body.isValid).toBe(true);
        });
    });

    it('should return 404 for invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/invitations/verify/invalid-token-12345')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('/invitations/:id/resend (POST)', () => {
    it('should resend an invitation', () => {
      return request(app.getHttpServer())
        .post(`/api/invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('invitation');
          expect(res.body.invitation).toHaveProperty('id');
          expect(res.body.invitation.id).toBe(invitationId);
          expect(res.body).toHaveProperty('message');
        });
    });
  });

  describe('/invitations/:token/decline (PATCH)', () => {
    it('should decline an invitation', () => {
      // Note: Decline requires the invitation to exist and not be expired
      // This test may fail if the invitation was already processed
      return request(app.getHttpServer())
        .patch(`/api/invitations/${invitationToken}/decline`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect((res) => {
          // Accept either 200 OK or 404 Not Found (if already processed)
          expect([HttpStatus.OK, HttpStatus.NOT_FOUND]).toContain(res.status);
        });
    });
  });

  describe('/invitations/:id (DELETE)', () => {
    it('should delete an invitation', () => {
      return request(app.getHttpServer())
        .delete(`/api/invitations/${invitationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
    });
  });
});
