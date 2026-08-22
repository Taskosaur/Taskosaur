import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role, UserStatus } from '@prisma/client';

/**
 * Regression tests for GHSA-24r4-9x59-jhw6, the incomplete fix for
 * CVE-2026-31874.
 *
 * The original fix stopped a non-admin changing their own `role` but left
 * `status` writable through the same self-update route. A user holding a token
 * issued before an administrator deactivated them could PATCH /api/users/:id on
 * themselves, set `status` back to ACTIVE, and restore password login,
 * undoing the deactivation.
 *
 * Two things have to hold for that to be closed:
 *   1. The self-update route refuses the fields that describe the account's
 *      standing rather than the person's profile.
 *   2. A token issued before deactivation stops working immediately, rather
 *      than remaining valid until it expires. Without this, the window the
 *      report describes stays open through every other authenticated route.
 */
describe('GHSA-24r4-9x59-jhw6 self-reactivation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const password = 'StrongPassword123!';
  const stamp = `${Date.now()}`;
  const email = `selfreact-${stamp}@example.com`;

  let user: any;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Self',
        lastName: 'React',
        username: `selfreact_${stamp}`,
        role: Role.MEMBER,
      })
      .expect(HttpStatus.CREATED);

    user = reg.body.user;
    userToken = reg.body.access_token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  describe('while the account is still active', () => {
    it('lets the owner edit their own profile fields', async () => {
      await request(app.getHttpServer())
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'Renamed', bio: 'still allowed' })
        .expect(HttpStatus.OK);
    });

    it('refuses a self-update that sets status', async () => {
      await request(app.getHttpServer())
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: UserStatus.ACTIVE })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('refuses a self-update that sets role', async () => {
      await request(app.getHttpServer())
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: Role.SUPER_ADMIN })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('refuses a self-update that marks the address verified', async () => {
      await request(app.getHttpServer())
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ emailVerified: true })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('refuses the whole request when a privileged field rides along with profile fields', async () => {
      await request(app.getHttpServer())
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'Smuggled', status: UserStatus.ACTIVE })
        .expect(HttpStatus.FORBIDDEN);

      // Nothing was written: a refused request must not apply its harmless half.
      const after = await prisma.user.findUnique({ where: { id: user.id } });
      expect(after?.firstName).not.toBe('Smuggled');
    });
  });

  describe('after an administrator deactivates the account', () => {
    beforeAll(async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.INACTIVE, refreshToken: null },
      });
    });

    it('rejects the token that was issued before the deactivation', async () => {
      // This is the heart of the report: the token is unexpired and was valid a
      // moment ago. It must stop working the instant the account is not active.
      await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('cannot self-reactivate through the self-update route', async () => {
      await request(app.getHttpServer())
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: UserStatus.ACTIVE })
        .expect(HttpStatus.UNAUTHORIZED);

      const after = await prisma.user.findUnique({ where: { id: user.id } });
      expect(after?.status).toBe(UserStatus.INACTIVE);
    });

    it('still cannot log in with the password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect((res) => {
          if (res.status === HttpStatus.OK || res.status === HttpStatus.CREATED) {
            throw new Error(`a deactivated account logged in: ${res.status}`);
          }
        });
    });

    it('works again once an administrator restores the account', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      });

      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(HttpStatus.OK);

      expect(login.body.access_token).toBeTruthy();
    });
  });
});
