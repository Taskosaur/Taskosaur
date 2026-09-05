import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

/**
 * task-statuses.controller.ts carries
 * `@Roles(Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN)` on its update and delete
 * routes, but those decorators did nothing.
 *
 * RolesGuard reads that metadata, and RolesGuard was never registered: the
 * controller declares `@UseGuards(JwtAuthGuard)` only, and app.module registers
 * just JwtAuthGuard as an APP_GUARD. Nothing consumed ROLES_KEY on this route,
 * so the requirement existed in the source and not at runtime. The service
 * behind it checked organization membership without reading the member's role.
 *
 * That is the worst shape for an authorization control: it reads as enforced,
 * so a reviewer sees the intent and moves on, while any member of the
 * organization could rename or delete the statuses every project depends on.
 *
 * Reads stay open to any member.
 */
describe('Task status mutations require MANAGER or above (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const stamp = `${Date.now()}`;
  const createdUserIds: string[] = [];
  let workflowId: string;
  let statusId: string;
  let memberToken: string;
  let managerToken: string;

  const mkUser = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `tsauth-${label}-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        password: 'x',
        firstName: 'TS',
        lastName: label,
        role: Role.MEMBER,
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
    const owner = await mkUser('owner');
    const manager = await mkUser('manager');
    const member = await mkUser('member');

    const token = (u: { id: string; email: string }) =>
      jwt.sign({ sub: u.id, email: u.email, role: Role.MEMBER });
    managerToken = token(manager);
    memberToken = token(member);

    const org = await prisma.organization.create({
      data: {
        name: `TSAuth Org ${stamp}`,
        slug: `tsauth-org-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        ownerId: owner.id,
      },
    });
    await prisma.organizationMember.createMany({
      data: [
        { userId: owner.id, organizationId: org.id, role: Role.OWNER },
        { userId: manager.id, organizationId: org.id, role: Role.MANAGER },
        { userId: member.id, organizationId: org.id, role: Role.MEMBER },
      ],
    });

    const workflow = await prisma.workflow.create({
      data: { name: `TSAuth Flow ${stamp}`, organizationId: org.id, isDefault: false },
    });
    workflowId = workflow.id;

    const status = await prisma.taskStatus.create({
      data: {
        name: 'To Do',
        color: '#ff0000',
        position: 1,
        workflowId,
        category: 'TODO',
      },
    });
    statusId = status.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { ownerId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('a plain member', () => {
    it('cannot rename a status every project relies on', async () => {
      await request(app.getHttpServer())
        .patch(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Renamed by a member' })
        .expect(HttpStatus.FORBIDDEN);

      const after = await prisma.taskStatus.findUnique({ where: { id: statusId } });
      expect(after?.name).toBe('To Do');
    });

    it('cannot delete a status', async () => {
      await request(app.getHttpServer())
        .delete(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.FORBIDDEN);

      const after = await prisma.taskStatus.findUnique({ where: { id: statusId } });
      expect(after?.deletedAt).toBeNull();
    });

    it('can still read statuses', async () => {
      await request(app.getHttpServer())
        .get(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(HttpStatus.OK);
    });
  });

  describe('a manager', () => {
    it('can rename a status', async () => {
      await request(app.getHttpServer())
        .patch(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Renamed by a manager' })
        .expect(HttpStatus.OK);

      const after = await prisma.taskStatus.findUnique({ where: { id: statusId } });
      expect(after?.name).toBe('Renamed by a manager');
    });

    it('can delete a status', async () => {
      await request(app.getHttpServer())
        .delete(`/api/task-statuses/${statusId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect((res) => {
          if (res.status !== HttpStatus.OK && res.status !== HttpStatus.NO_CONTENT) {
            throw new Error(`Expected the delete to be allowed, got ${res.status}`);
          }
        });

      const after = await prisma.taskStatus.findUnique({ where: { id: statusId } });
      expect(after?.deletedAt).not.toBeNull();
    });
  });
});
