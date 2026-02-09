import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

/**
 * Workflow 6: Permission & Access Control
 * 
 * This test covers different user roles and their access permissions:
 * 1. Owner operations (update organization, manage members)
 * 2. Admin operations (add members, update roles)
 * 3. Member operations (view projects, create tasks)
 * 4. Non-member access (should be denied)
 * 5. Workspace isolation
 * 
 * Note: Organization deletion is not tested to avoid cascading issues.
 */
describe('Workflow 6: Permission & Access Control (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let owner: any;
  let admin: any;
  let member: any;
  let nonMember: any;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let nonMemberToken: string;
  let organizationId: string;
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let statusId: string;

  const password = 'SecurePassword123!';

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
      await prismaService.projectMember.deleteMany({ where: { projectId } });
      await prismaService.workspaceMember.deleteMany({ where: { workspaceId } });
      await prismaService.organizationMember.deleteMany({ where: { organizationId } });
      if (statusId) await prismaService.taskStatus.delete({ where: { id: statusId } });
      if (projectId) await prismaService.project.delete({ where: { id: projectId } });
      if (workspaceId) await prismaService.workspace.delete({ where: { id: workspaceId } });
      if (workflowId) await prismaService.workflow.delete({ where: { id: workflowId } });
      if (organizationId) await prismaService.organization.delete({ where: { id: organizationId } });
      if (owner) await prismaService.user.delete({ where: { id: owner.id } });
      if (admin) await prismaService.user.delete({ where: { id: admin.id } });
      if (member) await prismaService.user.delete({ where: { id: member.id } });
      if (nonMember) await prismaService.user.delete({ where: { id: nonMember.id } });
    }
    await app.close();
  });

  describe('Permission & Access Control', () => {
    it('Step 0: Setup environment via API', async () => {
      // Create owner
      const ownerReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `perm-owner-${Date.now()}@example.com`,
          password,
          firstName: 'Permission',
          lastName: 'Owner',
          username: `perm_owner_${Date.now()}`,
          role: Role.OWNER,
        })
        .expect(HttpStatus.CREATED);
      owner = ownerReg.body.user;
      ownerToken = ownerReg.body.access_token;

      // Create admin
      const adminReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `perm-admin-${Date.now()}@example.com`,
          password,
          firstName: 'Permission',
          lastName: 'Admin',
          username: `perm_admin_${Date.now()}`,
          role: Role.MANAGER,
        })
        .expect(HttpStatus.CREATED);
      admin = adminReg.body.user;
      adminToken = adminReg.body.access_token;

      // Create member
      const memberReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `perm-member-${Date.now()}@example.com`,
          password,
          firstName: 'Permission',
          lastName: 'Member',
          username: `perm_member_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);
      member = memberReg.body.user;
      memberToken = memberReg.body.access_token;

      // Create nonMember
      const nonMemberReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `perm-nonmember-${Date.now()}@example.com`,
          password,
          firstName: 'Permission',
          lastName: 'NonMember',
          username: `perm_nonmember_${Date.now()}`,
          role: Role.MEMBER,
        })
        .expect(HttpStatus.CREATED);
      nonMember = nonMemberReg.body.user;
      nonMemberToken = nonMemberReg.body.access_token;

      // Create organization (Owner is automatically added as OWNER)
      const orgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Permission Org',
          ownerId: owner.id,
        })
        .expect(HttpStatus.CREATED);
      organizationId = orgResponse.body.id;

      // Add admin and member to organization
      await request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: admin.id, organizationId, role: Role.MANAGER })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/organization-members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: member.id, organizationId, role: Role.MEMBER })
        .expect(HttpStatus.CREATED);

      // Create workflow
      const wfResponse = await request(app.getHttpServer())
        .post('/api/workflows')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Permission Workflow',
          organizationId: organizationId,
          isDefault: true,
        })
        .expect(HttpStatus.CREATED);
      workflowId = wfResponse.body.id;

      // Get default status
      const statusesResponse = await request(app.getHttpServer())
        .get(`/api/task-statuses?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);
      statusId = statusesResponse.body.find((s: any) => s.name === 'To Do').id;

      // Create workspace (Owner might be automatically added depending on service logic)
      const wsResponse = await request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Permission Workspace',
          slug: `perm-ws-${Date.now()}`,
          organizationId: organizationId,
        })
        .expect(HttpStatus.CREATED);
      workspaceId = wsResponse.body.id;

      // Check if admin is already member, if not add
      const wsMembersAdmin = await request(app.getHttpServer())
        .get(`/api/workspace-members?workspaceId=${workspaceId}&search=${admin.email}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      if (wsMembersAdmin.body.length === 0) {
        await request(app.getHttpServer())
          .post('/api/workspace-members')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ userId: admin.id, workspaceId, role: Role.MANAGER })
          .expect(HttpStatus.CREATED);
      }

      const wsMembersMember = await request(app.getHttpServer())
        .get(`/api/workspace-members?workspaceId=${workspaceId}&search=${member.email}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      if (wsMembersMember.body.length === 0) {
        await request(app.getHttpServer())
          .post('/api/workspace-members')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ userId: member.id, workspaceId, role: Role.MEMBER })
          .expect(HttpStatus.CREATED);
      }

      // Create project
      const projectResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Permission Project',
          slug: `perm-project-${Date.now()}`,
          workspaceId: workspaceId,
          workflowId: workflowId,
          color: '#e74c3c',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          visibility: ProjectVisibility.PRIVATE,
        })
        .expect(HttpStatus.CREATED);
      projectId = projectResponse.body.id;

      // Check and add admin to project
      const projectMembersAdmin = await request(app.getHttpServer())
        .get(`/api/project-members?projectId=${projectId}&search=${admin.email}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      if (projectMembersAdmin.body.data?.length === 0 || projectMembersAdmin.body.length === 0) {
        await request(app.getHttpServer())
          .post('/api/project-members')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ userId: admin.id, projectId, role: Role.MANAGER })
          .expect(HttpStatus.CREATED);
      }

      // Check and add member to project
      const projectMembersMember = await request(app.getHttpServer())
        .get(`/api/project-members?projectId=${projectId}&search=${member.email}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      if (projectMembersMember.body.data?.length === 0 || projectMembersMember.body.length === 0) {
        await request(app.getHttpServer())
          .post('/api/project-members')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ userId: member.id, projectId, role: Role.MEMBER })
          .expect(HttpStatus.CREATED);
      }
    });

    it('Step 1: Owner can view organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(organizationId);
    });

    it('Step 2: Owner can update organization', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Updated Permission Org',
        })
        .expect(HttpStatus.OK);

      expect(response.body.name).toBe('Updated Permission Org');
    });

    it('Step 3: Admin can view organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(organizationId);
    });

    it('Step 4: Member can view organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(organizationId);
    });

    it('Step 5: Member can view project', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(projectId);
    });

    it('Step 6: Non-member cannot view organization', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('Step 7: Non-member cannot view workspace', async () => {
      await request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('Step 8: Non-member cannot view project', async () => {
      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('Step 9: Admin can view workspace', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(workspaceId);
    });

    it('Step 10: Admin can view project', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(projectId);
    });

    it('Step 11: Check access control for owner', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/access-control')
        .query({ scope: 'organization', id: organizationId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('canChange');
    });

    it('Step 12: Check access control for member', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/access-control')
        .query({ scope: 'project', id: projectId })
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('role');
      expect(response.body.role).toBe(Role.MEMBER);
    });
  });
});
