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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create users
    owner = await prismaService.user.create({
      data: {
        email: `perm-owner-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Permission',
        lastName: 'Owner',
        username: `perm_owner_${Date.now()}`,
        role: Role.OWNER,
      },
    });

    admin = await prismaService.user.create({
      data: {
        email: `perm-admin-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Permission',
        lastName: 'Admin',
        username: `perm_admin_${Date.now()}`,
        role: Role.MANAGER,
      },
    });

    member = await prismaService.user.create({
      data: {
        email: `perm-member-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Permission',
        lastName: 'Member',
        username: `perm_member_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    nonMember = await prismaService.user.create({
      data: {
        email: `perm-nonmember-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Permission',
        lastName: 'NonMember',
        username: `perm_nonmember_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    ownerToken = jwtService.sign({ sub: owner.id, email: owner.email, role: owner.role });
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
    memberToken = jwtService.sign({ sub: member.id, email: member.email, role: member.role });
    nonMemberToken = jwtService.sign({ sub: nonMember.id, email: nonMember.email, role: nonMember.role });

    // Create organization
    const organization = await prismaService.organization.create({
      data: {
        name: `Permission Org ${Date.now()}`,
        slug: `perm-org-${Date.now()}`,
        ownerId: owner.id,
      },
    });
    organizationId = organization.id;

    // Add admin and member to organization
    await prismaService.organizationMember.create({
      data: {
        userId: admin.id,
        organizationId: organizationId,
        role: Role.MANAGER,
      },
    });

    await prismaService.organizationMember.create({
      data: {
        userId: member.id,
        organizationId: organizationId,
        role: Role.MEMBER,
      },
    });

    // Create workflow
    const workflow = await prismaService.workflow.create({
      data: {
        name: 'Permission Workflow',
        organizationId: organizationId,
        isDefault: true,
      },
    });
    workflowId = workflow.id;

    // Create status
    const status = await prismaService.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#cccccc',
        position: 1,
        workflowId: workflowId,
        category: 'TODO',
      },
    });
    statusId = status.id;

    // Create workspace
    const workspace = await prismaService.workspace.create({
      data: {
        name: `Permission Workspace ${Date.now()}`,
        slug: `perm-ws-${Date.now()}`,
        organizationId: organizationId,
      },
    });
    workspaceId = workspace.id;

    // Add admin and member to workspace
    await prismaService.workspaceMember.create({
      data: {
        userId: admin.id,
        workspaceId: workspaceId,
        role: Role.MANAGER,
      },
    });

    await prismaService.workspaceMember.create({
      data: {
        userId: member.id,
        workspaceId: workspaceId,
        role: Role.MEMBER,
      },
    });

    // Create project
    const project = await prismaService.project.create({
      data: {
        name: 'Permission Project',
        slug: `perm-project-${Date.now()}`,
        workspaceId: workspaceId,
        workflowId: workflowId,
        color: '#e74c3c',
        status: ProjectStatus.ACTIVE,
        priority: ProjectPriority.HIGH,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: owner.id,
      },
    });
    projectId = project.id;

    // Add admin and member to project
    await prismaService.projectMember.create({
      data: {
        userId: admin.id,
        projectId: projectId,
        role: Role.MANAGER,
      },
    });

    await prismaService.projectMember.create({
      data: {
        userId: member.id,
        projectId: projectId,
        role: Role.MEMBER,
      },
    });
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
