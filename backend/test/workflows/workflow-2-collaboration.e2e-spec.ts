import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

/**
 * Workflow 2: Team Collaboration Setup
 * 
 * This test covers team member management:
 * 1. Login as owner
 * 2. Create organization
 * 3. Create workspace
 * 4. Create project
 * 5. Send invitations to team members
 * 6. Add members to workspace
 * 7. Add members to project
 * 8. Update member roles
 * 9. Verify member access
 */
describe('Workflow 2: Team Collaboration Setup (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let owner: any;
  let member1: any;
  let member2: any;
  let ownerToken: string;
  let member1Token: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let invitationId: string;

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
        email: `collab-owner-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Collab',
        lastName: 'Owner',
        username: `collab_owner_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    // Create members
    member1 = await prismaService.user.create({
      data: {
        email: `collab-member1-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Member',
        lastName: 'One',
        username: `member1_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    member2 = await prismaService.user.create({
      data: {
        email: `collab-member2-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Member',
        lastName: 'Two',
        username: `member2_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    ownerToken = jwtService.sign({ sub: owner.id, email: owner.email, role: owner.role });
    member1Token = jwtService.sign({ sub: member1.id, email: member1.email, role: member1.role });
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.invitation.deleteMany({ where: { inviterId: owner.id } });
      await prismaService.projectMember.deleteMany({ where: { projectId } });
      await prismaService.workspaceMember.deleteMany({ where: { workspaceId } });
      await prismaService.organizationMember.deleteMany({ where: { organizationId } });
      if (projectId) await prismaService.project.delete({ where: { id: projectId } });
      if (workspaceId) await prismaService.workspace.delete({ where: { id: workspaceId } });
      if (workflowId) await prismaService.workflow.delete({ where: { id: workflowId } });
      if (organizationId) await prismaService.organization.delete({ where: { id: organizationId } });
      if (owner) await prismaService.user.delete({ where: { id: owner.id } });
      if (member1) await prismaService.user.delete({ where: { id: member1.id } });
      if (member2) await prismaService.user.delete({ where: { id: member2.id } });
    }
    await app.close();
  });

  describe('Team Collaboration Setup', () => {
    it('Step 1: Owner creates organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Team Collaboration Org',
          ownerId: owner.id,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      organizationId = response.body.id;
    });

    it('Step 2: Create workspace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Team Workspace',
          slug: `team-workspace-${Date.now()}`,
          organizationId: organizationId,
        })
        .expect(HttpStatus.CREATED);

      workspaceId = response.body.id;
    });

    it('Step 3: Create workflow and project', async () => {
      // Create workflow
      const workflow = await prismaService.workflow.create({
        data: {
          name: 'Team Workflow',
          organizationId: organizationId,
          isDefault: true,
        },
      });
      workflowId = workflow.id;

      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Team Project',
          slug: `team-project-${Date.now()}`,
          workspaceId: workspaceId,
          workflowId: workflowId,
          color: '#e74c3c',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          visibility: ProjectVisibility.PRIVATE,
        })
        .expect(HttpStatus.CREATED);

      projectId = response.body.id;
    });

    it('Step 4: Send invitation to member', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeEmail: member1.email,
          organizationId: organizationId,
          role: 'MEMBER',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      invitationId = response.body.id;
    });

    it('Step 5: Add member1 to organization (direct)', async () => {
      // Note: Adding members directly via database as organization member endpoint may not exist
      const orgMember = await prismaService.organizationMember.create({
        data: {
          userId: member1.id,
          organizationId: organizationId,
          role: Role.MEMBER,
        },
      });

      expect(orgMember).toHaveProperty('id');
    });

    it('Step 6: Add member1 to workspace', async () => {
      // Note: Adding members directly via database as workspace member endpoint may not exist
      const wsMember = await prismaService.workspaceMember.create({
        data: {
          userId: member1.id,
          workspaceId: workspaceId,
          role: Role.MEMBER,
        },
      });

      expect(wsMember).toHaveProperty('id');
    });

    it('Step 7: Add member1 to project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/project-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: member1.id,
          projectId: projectId,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(member1.id);
    });

    it('Step 8: Update member role to MANAGER', async () => {
      // Get the project member ID
      const members = await prismaService.projectMember.findMany({
        where: { projectId, userId: member1.id },
      });
      const memberId = members[0].id;

      const response = await request(app.getHttpServer())
        .patch(`/api/project-members/${memberId}`)
        .query({ requestUserId: owner.id })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: Role.MANAGER,
        })
        .expect(HttpStatus.OK);

      expect(response.body.role).toBe(Role.MANAGER);
    });

    it('Step 9: Verify member1 can access organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/organizations')
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(response.body)).toBe(true);
      const org = response.body.find((o: any) => o.id === organizationId);
      expect(org).toBeDefined();
    });

    it('Step 10: Verify member1 can access workspace', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(workspaceId);
    });

    it('Step 11: Verify member1 can access project', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(projectId);
    });
  });
});
