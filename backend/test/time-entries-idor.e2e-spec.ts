import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role, ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

/**
 * Regression test for GHSA-48c6-42cv-7fqx (cross-tenant IDOR).
 *
 * An attacker who owns only their own throwaway organization must not be able
 * to read, enumerate, tamper with, or delete another organization's time
 * entries, members, or task statuses. This reproduces the advisory PoC and
 * asserts the endpoints are now tenant-isolated.
 */
describe('Cross-tenant IDOR (GHSA-48c6-42cv-7fqx) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const password = 'StrongPassword123!';
  const stamp = `${Date.now()}`;

  let victim: any;
  let attacker: any;
  let attackerToken: string;
  let victimToken: string;

  let victimOrgId: string;
  let attackerOrgId: string;
  let victimWorkspaceId: string;
  let victimWorkflowId: string;
  let victimProjectId: string;
  let victimTaskId: string;
  let victimStatusId: string;
  let victimEntryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Victim registers and owns VictimCorp.
    const victimReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `idor-victim-${stamp}@example.com`,
        password,
        firstName: 'Vic',
        lastName: 'Tim',
        username: `idor_victim_${stamp}`,
        role: Role.OWNER,
      })
      .expect(HttpStatus.CREATED);
    victim = victimReg.body.user;
    victimToken = victimReg.body.access_token;

    // Attacker registers as a plain member and owns only AttackerCorp.
    const attackerReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `idor-attacker-${stamp}@example.com`,
        password,
        firstName: 'Mal',
        lastName: 'Ory',
        username: `idor_attacker_${stamp}`,
        role: Role.MEMBER,
      })
      .expect(HttpStatus.CREATED);
    attacker = attackerReg.body.user;
    attackerToken = attackerReg.body.access_token;

    // VictimCorp with the victim as an OWNER member.
    const victimOrg = await prisma.organization.create({
      data: { name: `VictimCorp ${stamp}`, slug: `victimcorp-${stamp}`, ownerId: victim.id },
    });
    victimOrgId = victimOrg.id;
    await prisma.organizationMember.create({
      data: { userId: victim.id, organizationId: victimOrgId, role: Role.OWNER },
    });

    // AttackerCorp with the attacker as an OWNER member (of their OWN org only).
    const attackerOrg = await prisma.organization.create({
      data: { name: `AttackerCorp ${stamp}`, slug: `attackercorp-${stamp}`, ownerId: attacker.id },
    });
    attackerOrgId = attackerOrg.id;
    await prisma.organizationMember.create({
      data: { userId: attacker.id, organizationId: attackerOrgId, role: Role.OWNER },
    });

    // VictimCorp workflow / workspace / private project / task / status.
    const workflow = await prisma.workflow.create({
      data: { name: 'Default Workflow', organizationId: victimOrgId, isDefault: true },
    });
    victimWorkflowId = workflow.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `Victim Workspace ${stamp}`,
        slug: `victim-ws-${stamp}`,
        organizationId: victimOrgId,
      },
    });
    victimWorkspaceId = workspace.id;
    await prisma.workspaceMember.create({
      data: { userId: victim.id, workspaceId: victimWorkspaceId, role: Role.OWNER },
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
        name: 'Victim Project',
        slug: `victim-proj-${stamp}`,
        workspaceId: victimWorkspaceId,
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.MEDIUM,
        visibility: ProjectVisibility.PRIVATE,
        createdBy: victim.id,
        workflowId: victimWorkflowId,
        color: '#000000',
      },
    });
    victimProjectId = project.id;
    await prisma.projectMember.create({
      data: { userId: victim.id, projectId: victimProjectId, role: Role.OWNER },
    });

    const task = await prisma.task.create({
      data: {
        title: 'Victim Secret Task',
        projectId: victimProjectId,
        statusId: victimStatusId,
        createdBy: victim.id,
        taskNumber: 1,
        slug: `VP-1-${stamp}`,
      },
    });
    victimTaskId = task.id;

    const entry = await prisma.timeEntry.create({
      data: {
        description: 'VICTIM confidential work log',
        timeSpent: 90,
        date: new Date(),
        taskId: victimTaskId,
        userId: victim.id,
        createdBy: victim.id,
      },
    });
    victimEntryId = entry.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.timeEntry.deleteMany({ where: { taskId: victimTaskId } });
      await prisma.task.deleteMany({ where: { id: victimTaskId } });
      await prisma.projectMember.deleteMany({ where: { projectId: victimProjectId } });
      await prisma.project.deleteMany({ where: { id: victimProjectId } });
      await prisma.taskStatus.deleteMany({ where: { workflowId: victimWorkflowId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: victimWorkspaceId } });
      await prisma.workspace.deleteMany({ where: { id: victimWorkspaceId } });
      await prisma.workflow.deleteMany({ where: { id: victimWorkflowId } });
      await prisma.organizationMember.deleteMany({
        where: { organizationId: { in: [victimOrgId, attackerOrgId] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [victimOrgId, attackerOrgId] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [victim.id, attacker.id] } } });
    }
    await app.close();
  });

  describe('time entries', () => {
    it('GET /time-entries without scope does not leak the victim entry', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/time-entries')
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.OK);
      const ids = (res.body as any[]).map((e) => e.id);
      expect(ids).not.toContain(victimEntryId);
    });

    it('GET /time-entries?taskId of another tenant is forbidden', () => {
      return request(app.getHttpServer())
        .get('/api/time-entries')
        .query({ taskId: victimTaskId })
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('GET /time-entries/:id of another tenant is not found', () => {
      return request(app.getHttpServer())
        .get(`/api/time-entries/${victimEntryId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('DELETE /time-entries/:id with a spoofed requestUserId is forbidden and does not destroy data', async () => {
      await request(app.getHttpServer())
        .delete(`/api/time-entries/${victimEntryId}`)
        .query({ requestUserId: victim.id })
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.FORBIDDEN);

      const stillThere = await prisma.timeEntry.findUnique({ where: { id: victimEntryId } });
      expect(stillThere).not.toBeNull();
    });

    it('PATCH /time-entries/:id of another tenant is forbidden', () => {
      return request(app.getHttpServer())
        .patch(`/api/time-entries/${victimEntryId}`)
        .query({ requestUserId: victim.id })
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ description: 'tampered' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('the owner can still read their own entry', () => {
      return request(app.getHttpServer())
        .get(`/api/time-entries/${victimEntryId}`)
        .set('Authorization', `Bearer ${victimToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => expect(res.body.id).toBe(victimEntryId));
    });
  });

  describe('member directories', () => {
    it('GET /organization-members without organizationId does not leak other tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/organization-members')
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.OK);
      const orgIds = (res.body as any[]).map((m) => m.organizationId);
      expect(orgIds).not.toContain(victimOrgId);
      const emails = (res.body as any[]).map((m) => m.user?.email);
      expect(emails).not.toContain(victim.email);
    });

    it('GET /project-members without projectId does not leak other tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/project-members')
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.OK);
      const projectIds = (res.body.data as any[]).map((m) => m.projectId);
      expect(projectIds).not.toContain(victimProjectId);
    });
  });

  describe('task statuses', () => {
    it('PATCH /task-statuses/:id of another tenant is forbidden', () => {
      return request(app.getHttpServer())
        .patch(`/api/task-statuses/${victimStatusId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ name: 'hijacked' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('DELETE /task-statuses/:id of another tenant is forbidden and does not destroy data', async () => {
      await request(app.getHttpServer())
        .delete(`/api/task-statuses/${victimStatusId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .expect(HttpStatus.FORBIDDEN);

      const stillThere = await prisma.taskStatus.findUnique({ where: { id: victimStatusId } });
      expect(stillThere?.deletedAt ?? null).toBeNull();
    });
  });
});
