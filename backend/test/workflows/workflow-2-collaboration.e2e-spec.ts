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
  jest.setTimeout(30000);
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

  const ownerPassword = 'SecurePassword123!';
  const member1Password = 'SecurePassword123!';
  const member2Password = 'SecurePassword123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup
      await prismaService.invitation.deleteMany({ where: { inviterId: owner?.id } });
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
    it('Step 0: Setup users via API', async () => {
      // Create owner
      const ownerEmail = `collab-owner-${Date.now()}@example.com`;
      const ownerReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: ownerEmail,
          password: ownerPassword,
          firstName: 'Collab',
          lastName: 'Owner',
          username: `collab_owner_${Date.now()}`,
          role: Role.OWNER,
        })
        .expect(HttpStatus.CREATED);
      
      owner = ownerReg.body.user;
      ownerToken = ownerReg.body.access_token;

      // Create member1
      const member1Email = `collab-member1-${Date.now()}@example.com`;
      const member1Reg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: member1Email,
          password: member1Password,
          firstName: 'Member',
          lastName: 'One',
          username: `member1_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);
      
      member1 = member1Reg.body.user;
      member1Token = member1Reg.body.access_token;

      // Create member2
      const member2Email = `collab-member2-${Date.now()}@example.com`;
      const member2Reg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: member2Email,
          password: member2Password,
          firstName: 'Member',
          lastName: 'Two',
          username: `member2_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);
      
      member2 = member2Reg.body.user;
    });

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
      const workflowResponse = await request(app.getHttpServer())
        .post('/api/workflows')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Team Workflow',
          organizationId: organizationId,
          isDefault: true,
        })
        .expect(HttpStatus.CREATED);
      
      workflowId = workflowResponse.body.id;

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

    it('Step 5: Add member1 to organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: member1.id,
          organizationId: organizationId,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
    });

    it('Step 6: Add member1 to workspace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/workspace-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: member1.id,
          workspaceId: workspaceId,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
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
      // Get the project member ID via API
      const memberResponse = await request(app.getHttpServer())
        .get(`/api/project-members/user/${member1.id}/project/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);
      
      const memberId = memberResponse.body.id;

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
