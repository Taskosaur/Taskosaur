import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Regression tests for CVE-2026-31874 / GHSA-r6gj-4663-p5mr: role assignment by
 * parameter manipulation during registration.
 *
 * The report showed that adding `"role": "SUPER_ADMIN"` to the registration
 * body produced an administrator account, because the value was passed straight
 * through to the create. The advisory was marked fixed but carried no
 * regression test, so nothing stopped it coming back.
 *
 * The related follow-up, GHSA-24r4-9x59-jhw6, is covered separately in
 * self-reactivation-advisory.e2e-spec.ts.
 */
describe('CVE-2026-31874 role assignment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const password = 'StrongPassword123!';
  const stamp = `${Date.now()}`;
  const emails: string[] = [];

  const register = async (label: string, extra: Record<string, unknown> = {}) => {
    const email = `roleadv-${label}-${stamp}@example.com`;
    emails.push(email);
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Role',
        lastName: 'Adv',
        username: `roleadv_${label}_${stamp}`,
        ...extra,
      })
      .expect(HttpStatus.CREATED);
    return { email, body: res.body };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // The bootstrap rule promotes the first sign-in on an instance with no
    // administrator. This database already has one, so it does not apply here;
    // asserting it keeps the tests below honest about what they are proving.
    const admin = await prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN, deletedAt: null },
      select: { id: true },
    });
    expect(admin).not.toBeNull();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('ignores a role supplied in the registration body', async () => {
    // The PoC verbatim: the attacker adds a role to the request.
    const { email } = await register('superadmin', { role: 'SUPER_ADMIN' });

    const created = await prisma.user.findUnique({ where: { email } });
    expect(created?.role).toBe(Role.MEMBER);
  });

  it.each([[Role.OWNER], [Role.MANAGER], [Role.SUPER_ADMIN]])(
    'ignores a supplied role of %s',
    async (role) => {
      const { email } = await register(`as-${String(role).toLowerCase()}`, { role });
      const created = await prisma.user.findUnique({ where: { email } });
      expect(created?.role).toBe(Role.MEMBER);
    },
  );

  it('does not hand back an elevated role in the registration response', async () => {
    const { body } = await register('response', { role: 'SUPER_ADMIN' });
    expect(body.user.role).toBe(Role.MEMBER);
  });

  it('does not let a registered account reach an admin-only route', async () => {
    const { body } = await register('adminroute', { role: 'SUPER_ADMIN' });

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${body.access_token}`)
      .expect(HttpStatus.FORBIDDEN);
  });

  it('does not promote a later account when an administrator already exists', async () => {
    // The bootstrap rule asks whether this instance has an administrator, not
    // whether this is the oldest account. If it asked the latter, deleting the
    // founding account would silently promote whoever came next at their next
    // login.
    const { email } = await register('afteradmin');

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);

    const after = await prisma.user.findUnique({ where: { email } });
    expect(after?.role).toBe(Role.MEMBER);
  });
});
