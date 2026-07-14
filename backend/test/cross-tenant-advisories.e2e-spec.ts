import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

/**
 * Regression tests for the remaining triage advisories:
 * - GHSA-97m3-fcc5-v5r2 (workflows: cross-tenant read/write/delete)
 * - GHSA-fjwc-33jp-r5xr (invitations: self-invite as OWNER of any org)
 * - GHSA-2653-wx6f-7xv9 (notifications: read another user's feed)
 * - GHSA-m586-9w8m-j724 (task-watchers: cross-tenant read + spoofable delete)
 *
 * An attacker who owns only AttackerCorp must not be able to touch VictimCorp's
 * workflows, invite themselves into VictimCorp, read the victim's notifications,
 * or read/delete the victim's task watchers.
 */
describe('Cross-tenant triage advisories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const password = 'StrongPassword123!';
  const stamp = `${Date.now()}`;
  // Invitation creation is gated behind an SMTP/dev check that runs before the
  // authorization logic; development mode bypasses it so the auth check is
  // actually exercised. Mirrors the existing invitations e2e spec.
  const originalNodeEnv = process.env.NODE_ENV;

  let victim: any;
  let attacker: any;
  let attackerToken: string;

  let victimOrgId: string;
  let attackerOrgId: string;
  let victimWorkflowId: string;
  let victimTaskId: string;
  let victimStatusId: string;
  let victimWatcherId: string;
  let victimNotificationId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    const victimReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `adv-victim-${stamp}@example.com`,
        password,
        firstName: 'Vic',
        lastName: 'Tim',
        username: `adv_victim_${stamp}`,
        role: Role.OWNER,
      })
      .expect(HttpStatus.CREATED);
    victim = victimReg.body.user;

    const attackerReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `adv-attacker-${stamp}@example.com`,
        password,
        firstName: 'Mal',
        lastName: 'Ory',
        username: `adv_attacker_${stamp}`,
        role: Role.MEMBER,
      })
      .expect(HttpStatus.CREATED);
    attacker = attackerReg.body.user;
    attackerToken = attackerReg.body.access_token;

    const victimOrg = await prisma.organization.create({
      data: { name: `AdvVictim ${stamp}`, slug: `adv-victim-${stamp}`, ownerId: victim.id },
    });
    victimOrgId = victimOrg.id;
    await prisma.organizationMember.create({
      data: { userId: victim.id, organizationId: victimOrgId, role: Role.OWNER },
    });

    const attackerOrg = await prisma.organization.create({
      data: { name: `AdvAttacker ${stamp}`, slug: `adv-attacker-${stamp}`, ownerId: attacker.id },
    });
    attackerOrgId = attackerOrg.id;
    await prisma.organizationMember.create({
      data: { userId: attacker.id, organizationId: attackerOrgId, role: Role.OWNER },
    });

    const workflow = await prisma.workflow.create({
      data: { name: 'Victim Workflow', organizationId: victimOrgId, isDefault: true },
    });
    victimWorkflowId = workflow.id;

    const workspace = await prisma.workspace.create({
      data: { name: `AdvWs ${stamp}`, slug: `adv-ws-${stamp}`, organizationId: victimOrgId },
    });
    await prisma.workspaceMember.create({
      data: { userId: victim.id, workspaceId: workspace.id, role: Role.OWNER },
    });

    const status = await prisma.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#ff0000',
        position: 1,
        workflowId: victimWorkflowId,
        category: 'TODO',
      },
    });
    victimStatusId = status.id;

    const project = await prisma.project.create({
      data: {
        name: 'Adv Victim Project',
        slug: `adv-proj-${stamp}`,
        workspaceId: workspace.id,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: victim.id,
        workflowId: victimWorkflowId,
        color: '#000000',
      },
    });
    await prisma.projectMember.create({
      data: { userId: victim.id, projectId: project.id, role: Role.OWNER },
    });

    const task = await prisma.task.create({
      data: {
        title: 'Adv Victim Task',
        projectId: project.id,
        statusId: victimStatusId,
        createdBy: victim.id,
        taskNumber: 1,
        slug: `AVP-1-${stamp}`,
      },
    });
    victimTaskId = task.id;

    const watcher = await prisma.taskWatcher.create({
      data: { taskId: victimTaskId, userId: victim.id },
    });
    victimWatcherId = watcher.id;

    const notification = await prisma.notification.create({
      data: {
        title: 'Victim private notification',
        message: 'Sensitive: assigned to secret task',
        type: 'TASK_ASSIGNED' as any,
        userId: victim.id,
        organizationId: victimOrgId,
      },
    });
    victimNotificationId = notification.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.taskWatcher.deleteMany({ where: { taskId: victimTaskId } });
      await prisma.notification.deleteMany({ where: { userId: victim.id } });
      await prisma.task.deleteMany({ where: { id: victimTaskId } });
      await prisma.projectMember.deleteMany({ where: { project: { workflowId: victimWorkflowId } } });
      await prisma.project.deleteMany({ where: { workflowId: victimWorkflowId } });
      await prisma.taskStatus.deleteMany({ where: { workflowId: victimWorkflowId } });
      await prisma.workspaceMember.deleteMany({
        where: { workspace: { organizationId: victimOrgId } },
      });
      await prisma.workspace.deleteMany({ where: { organizationId: victimOrgId } });
      await prisma.workflow.deleteMany({ where: { organizationId: victimOrgId } });
      await prisma.invitation.deleteMany({ where: { organizationId: { in: [victimOrgId] } } });
      await prisma.organizationMember.deleteMany({
        where: { organizationId: { in: [victimOrgId, attackerOrgId] } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: [victimOrgId, attackerOrgId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [victim.id, attacker.id] } } });
    }
    await app.close();
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('workflows (GHSA-97m3-fcc5-v5r2)', () => {
    it('GET /workflows/:id of another tenant is forbidden', () => {
      return request(app.getHttpServer())
        .get(`/api/workflows/${victimWorkflowId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('GET /workflows without organizationId does not leak other tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workflows')
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.OK);
      const ids = (res.body as any[]).map((w) => w.id);
      expect(ids).not.toContain(victimWorkflowId);
    });

    it('PATCH /workflows/:id of another tenant is forbidden', () => {
      return request(app.getHttpServer())
        .patch(`/api/workflows/${victimWorkflowId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ name: 'hijacked' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('DELETE /workflows/:id of another tenant is forbidden and does not destroy data', async () => {
      await request(app.getHttpServer())
        .delete(`/api/workflows/${victimWorkflowId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.FORBIDDEN);
      const stillThere = await prisma.workflow.findUnique({ where: { id: victimWorkflowId } });
      expect(stillThere).not.toBeNull();
    });
  });

  describe('invitations (GHSA-fjwc-33jp-r5xr)', () => {
    it('self-invite as OWNER of another organization is forbidden', async () => {
      await request(app.getHttpServer())
        .post('/api/invitations')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          inviteeEmail: attacker.email,
          organizationId: victimOrgId,
          role: Role.OWNER,
        })
        .expect(HttpStatus.FORBIDDEN);

      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId: attacker.id, organizationId: victimOrgId },
        },
      });
      expect(membership).toBeNull();
    });
  });

  describe('notifications (GHSA-2653-wx6f-7xv9)', () => {
    it("reading another user's notification feed is forbidden", () => {
      return request(app.getHttpServer())
        .get(`/api/notifications/user/${victim.id}/organization/${victimOrgId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('task-watchers (GHSA-m586-9w8m-j724)', () => {
    it('GET /task-watchers/:id of another tenant is not found', () => {
      return request(app.getHttpServer())
        .get(`/api/task-watchers/${victimWatcherId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('DELETE /task-watchers/:id with a spoofed requestUserId is forbidden and does not destroy data', async () => {
      await request(app.getHttpServer())
        .delete(`/api/task-watchers/${victimWatcherId}`)
        .query({ requestUserId: victim.id })
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.FORBIDDEN);
      const stillThere = await prisma.taskWatcher.findUnique({ where: { id: victimWatcherId } });
      expect(stillThere).not.toBeNull();
    });

    it('GET /task-watchers without scope does not leak the victim watcher', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/task-watchers')
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.OK);
      const ids = (res.body as any[]).map((w) => w.id);
      expect(ids).not.toContain(victimWatcherId);
    });
  });
});
