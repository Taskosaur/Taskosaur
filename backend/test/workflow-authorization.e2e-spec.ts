import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

/**
 * Changing a workflow required nothing beyond organization membership.
 *
 * The workflows controller carries only JwtAuthGuard, and the service checked
 * that the caller belonged to the organization without looking at what role
 * they held. So any member could rename a workflow, move the organization's
 * default, or delete a workflow outright.
 *
 * That inverted the permissions already in place next door: deleting a single
 * task status requires MANAGER or above, while deleting the whole workflow that
 * status lives in required only membership. A workflow is organization-wide, so
 * the wider operation cannot ask for less than the narrower one.
 *
 * Reads are deliberately still open to any member.
 */
describe('Workflow mutations require MANAGER or above (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const stamp = `${Date.now()}`;
  const createdUserIds: string[] = [];
  let organizationId: string;
  let workflowId: string;
  let memberToken: string;
  let managerToken: string;
  let viewerToken: string;

  const mkUser = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `wfauth-${label}-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        password: 'x',
        firstName: 'WF',
        lastName: label,
        role: Role.MEMBER, // global role; org role is what is under test
      },
    });
    createdUserIds.push(user.id);
    return user;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    // The organization owner is a separate account, so none of the accounts
    // under test can pass through the "you own this organization" shortcut.
    const owner = await mkUser('owner');
    const manager = await mkUser('manager');
    const member = await mkUser('member');
    const viewer = await mkUser('viewer');

    const token = (u: { id: string; email: string }) =>
      jwt.sign({ sub: u.id, email: u.email, role: Role.MEMBER });
    managerToken = token(manager);
    memberToken = token(member);
    viewerToken = token(viewer);

    const org = await prisma.organization.create({
      data: {
        name: `WFAuth Org ${stamp}`,
        slug: `wfauth-org-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        ownerId: owner.id,
      },
    });
    organizationId = org.id;

    await prisma.organizationMember.createMany({
      data: [
        { userId: owner.id, organizationId, role: Role.OWNER },
        { userId: manager.id, organizationId, role: Role.MANAGER },
        { userId: member.id, organizationId, role: Role.MEMBER },
        { userId: viewer.id, organizationId, role: Role.VIEWER },
      ],
    });

    const workflow = await prisma.workflow.create({
      data: { name: `WFAuth Flow ${stamp}`, organizationId, isDefault: false },
    });
    workflowId = workflow.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { ownerId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('a plain member', () => {
    it('cannot delete a workflow', async () => {
      await request(app.getHttpServer())
        .delete(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.FORBIDDEN);

      expect(await prisma.workflow.count({ where: { id: workflowId } })).toBe(1);
    });

    it('cannot rename a workflow', async () => {
      await request(app.getHttpServer())
        .patch(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Renamed by a member' })
        .expect(HttpStatus.FORBIDDEN);

      const after = await prisma.workflow.findUnique({ where: { id: workflowId } });
      expect(after?.name).not.toBe('Renamed by a member');
    });

    it('cannot move the organization default', async () => {
      await request(app.getHttpServer())
        .patch(`/api/workflows/${workflowId}/set-default`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ organizationId })
        .expect(HttpStatus.FORBIDDEN);

      const after = await prisma.workflow.findUnique({ where: { id: workflowId } });
      expect(after?.isDefault).toBe(false);
    });

    it('can still read the workflow', async () => {
      // Reads stay open; this is an authorization fix, not a lockout.
      await request(app.getHttpServer())
        .get(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.OK);
    });
  });

  describe('a viewer', () => {
    it('cannot delete a workflow either', async () => {
      await request(app.getHttpServer())
        .delete(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(HttpStatus.FORBIDDEN);

      expect(await prisma.workflow.count({ where: { id: workflowId } })).toBe(1);
    });
  });

  describe('a manager', () => {
    it('can rename a workflow', async () => {
      await request(app.getHttpServer())
        .patch(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Renamed by a manager' })
        .expect(HttpStatus.OK);

      const after = await prisma.workflow.findUnique({ where: { id: workflowId } });
      expect(after?.name).toBe('Renamed by a manager');
    });

    it('can delete a workflow nothing depends on', async () => {
      await request(app.getHttpServer())
        .delete(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect((res) => {
          if (res.status !== HttpStatus.OK && res.status !== HttpStatus.NO_CONTENT) {
            throw new Error(`Expected the delete to be allowed, got ${res.status}`);
          }
        });

      expect(await prisma.workflow.count({ where: { id: workflowId } })).toBe(0);
    });
  });
});
