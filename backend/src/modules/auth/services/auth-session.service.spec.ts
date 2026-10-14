import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { SYSTEM_USER_ID } from '../../../common/constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { SettingsService } from '../../settings/settings.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { JwtPayload, JwtStrategy } from '../strategies/jwt.strategy';
import { AuthSessionService } from './auth-session.service';
import { SetupService } from './setup.service';

// These injected collaborators are mocked below; avoid loading storage/email
// transports (including ESM-only dependencies) into the isolated auth suite.
jest.mock('../../users/users.service', () => ({ UsersService: class UsersService {} }));
jest.mock('../../email/email.service', () => ({ EmailService: class EmailService {} }));
jest.mock('../../settings/settings.service', () => ({ SettingsService: class SettingsService {} }));

type StoredSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
};
type SessionWhere = Partial<Pick<StoredSession, 'id' | 'userId' | 'refreshTokenHash'>> & {
  expiresAt?: { gt: Date };
};

describe('authentication session isolation', () => {
  let user: User;
  let rows: Map<string, StoredSession>;
  let users: Map<string, User>;
  let prisma: PrismaService;
  let sessions: AuthSessionService;
  let auth: AuthService;
  let strategy: JwtStrategy;
  let jwt: JwtService;
  let config: ConfigService;
  let passwordHash: string;
  let resetHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('test-password', 4);
    resetHash = await bcrypt.hash('test-reset-token', 4);
  });

  beforeEach(() => {
    user = {
      id: randomUUID(),
      email: 'session-test@example.com',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      firstName: 'Session',
      lastName: 'Test',
      username: 'session-test',
      password: passwordHash,
      refreshToken: null,
      resetToken: resetHash,
      resetTokenExpiry: new Date(Date.now() + 60_000),
    } as User;
    users = new Map([[user.id, user]]);
    rows = new Map();
    const matches = (row: StoredSession, where: SessionWhere): boolean =>
      (!where.id || row.id === where.id) &&
      (!where.userId || row.userId === where.userId) &&
      (!where.refreshTokenHash || row.refreshTokenHash === where.refreshTokenHash) &&
      (!where.expiresAt || row.expiresAt > where.expiresAt.gt);
    const database = {
      user: {
        count: jest.fn(async () => users.size),
        findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
          where.id
            ? users.get(where.id) || null
            : [...users.values()].find((value) => value.email === where.email) || null,
        ),
        create: jest.fn(async ({ data }: { data: Partial<User> }) => {
          const created = { ...user, ...data, id: randomUUID() } as User;
          users.set(created.id, created);
          return created;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
          const existing = users.get(where.id);
          if (!existing) throw new Error('User not found');
          Object.assign(existing, data);
          return existing;
        }),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; refreshToken: string; status?: UserStatus; deletedAt?: null };
            data: { refreshToken: null };
          }) => {
            const existing = users.get(where.id);
            if (
              !existing ||
              existing.refreshToken !== where.refreshToken ||
              (where.status && existing.status !== where.status) ||
              (where.deletedAt === null && existing.deletedAt !== null)
            )
              return { count: 0 };
            Object.assign(existing, data);
            return { count: 1 };
          },
        ),
      },
      authSession: {
        create: jest.fn(async ({ data }: { data: StoredSession }) => {
          rows.set(data.id, data);
          return data;
        }),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: SessionWhere;
            data: Pick<StoredSession, 'refreshTokenHash' | 'expiresAt'>;
          }) => {
            const row = [...rows.values()].find((candidate) => matches(candidate, where));
            if (!row) return { count: 0 };
            Object.assign(row, data);
            return { count: 1 };
          },
        ),
        findFirst: jest.fn(
          async ({ where }: { where: SessionWhere }) =>
            [...rows.values()].find((candidate) => matches(candidate, where)) || null,
        ),
        deleteMany: jest.fn(async ({ where }: { where: SessionWhere }) => {
          let count = 0;
          for (const [id, row] of rows) {
            if (matches(row, where)) {
              rows.delete(id);
              count++;
            }
          }
          return { count };
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
          callback(database as unknown as Prisma.TransactionClient),
      ),
    };
    prisma = database as unknown as PrismaService;
    config = new ConfigService({
      JWT_SECRET: 'access-test-secret',
      JWT_REFRESH_SECRET: 'refresh-test-secret',
      JWT_REFRESH_EXPIRES_IN: '7d',
    });
    jwt = new JwtService({ secret: 'access-test-secret', signOptions: { expiresIn: '1h' } });
    sessions = new AuthSessionService(prisma, jwt, config);
    const usersService = {
      findByEmail: jest.fn(async () => user),
      findOne: jest.fn(async (id: string) => users.get(id) || null),
      findAllUsersWithResetTokens: jest.fn(async () => [user]),
    } as unknown as UsersService;
    const emailService = {
      sendPasswordResetConfirmationEmail: jest.fn(async () => undefined),
    } as unknown as EmailService;
    auth = new AuthService(
      prisma,
      usersService,
      sessions,
      config,
      emailService,
      {} as SettingsService,
    );
    strategy = new JwtStrategy(config, usersService, sessions);
  });

  const payload = (token: string): JwtPayload => new JwtService().decode<JwtPayload>(token);

  it('keeps browser and agent logins independent, including logins in the same second', async () => {
    user.refreshToken = 'still-valid-legacy-cookie';
    const browser = await auth.login({ email: user.email, password: 'test-password' });
    const agent = await auth.login({ email: user.email, password: 'test-password' });
    expect(payload(browser.access_token).sid).not.toBe(payload(agent.access_token).sid);
    expect(browser.refresh_token).not.toBe(agent.refresh_token);
    expect(user.refreshToken).toBe('still-valid-legacy-cookie');
    expect([...rows.values()].map((row) => row.refreshTokenHash)).not.toContain(
      browser.refresh_token,
    );
    await sessions.refresh(browser.refresh_token);
    await sessions.refresh(agent.refresh_token);
    expect(rows.size).toBe(2);
  });

  it('rotates within the same session and allows only one winner for concurrent refreshes', async () => {
    const initial = await sessions.create(user);
    const results = await Promise.allSettled([
      sessions.refresh(initial.refresh_token),
      sessions.refresh(initial.refresh_token),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const success = results.find((result) => result.status === 'fulfilled');
    if (success?.status !== 'fulfilled') throw new Error('Missing successful refresh');
    expect(payload(success.value.refresh_token).sid).toBe(payload(initial.refresh_token).sid);
    expect(success.value.refresh_token).not.toBe(initial.refresh_token);
    await expect(sessions.refresh(initial.refresh_token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await sessions.refresh(success.value.refresh_token);
    expect(rows.size).toBe(1);
  });

  it('logout revokes only its own access and refresh session', async () => {
    const browser = await sessions.create(user);
    const agent = await sessions.create(user);
    await auth.logout(user.id, payload(agent.access_token).sid);
    await expect(strategy.validate(payload(agent.access_token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(sessions.refresh(agent.refresh_token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await strategy.validate(payload(browser.access_token));
    await sessions.refresh(browser.refresh_token);
  });

  it('logout clears only a refresh cookie belonging to the authenticated session', async () => {
    const browser = await sessions.create(user);
    const agent = await sessions.create(user);
    expect(await auth.logout(user.id, payload(agent.access_token).sid, browser.refresh_token)).toBe(
      false,
    );
    expect(
      await auth.logout(user.id, payload(browser.access_token).sid, browser.refresh_token),
    ).toBe(true);
  });

  it('password reset clears legacy and all new sessions in the same transaction', async () => {
    const browser = await sessions.create(user);
    const agent = await sessions.create(user);
    user.refreshToken = 'legacy-token';
    await auth.resetPassword('test-reset-token', 'new-password');
    expect(user.refreshToken).toBeNull();
    expect(rows.size).toBe(0);
    expect(await bcrypt.compare('new-password', user.password!)).toBe(true);
    await expect(sessions.refresh(browser.refresh_token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(sessions.refresh(agent.refresh_token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('adopts only the stored legacy token and only once under a race', async () => {
    const legacy = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: 'refresh-test-secret',
        expiresIn: '7d',
      },
    );
    user.refreshToken = legacy;
    const unlisted = jwt.sign(
      { sub: user.id, jti: randomUUID() },
      {
        secret: 'refresh-test-secret',
        expiresIn: '7d',
      },
    );
    await expect(sessions.refresh(unlisted)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(user.refreshToken).toBe(legacy);
    const results = await Promise.allSettled([sessions.refresh(legacy), sessions.refresh(legacy)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(rows.size).toBe(1);
    expect(user.refreshToken).toBeNull();
    await expect(sessions.refresh(legacy)).rejects.toBeInstanceOf(UnauthorizedException);
    await strategy.validate({ sub: user.id, email: user.email, role: user.role });
  });

  it('legacy logout cannot revoke an independent agent session', async () => {
    user.refreshToken = 'legacy-token';
    const agent = await sessions.create(user);
    await auth.logout(user.id, undefined, 'different-token');
    expect(user.refreshToken).toBe('legacy-token');
    await auth.logout(user.id, undefined, 'legacy-token');
    expect(user.refreshToken).toBeNull();
    await sessions.refresh(agent.refresh_token);
  });

  it.each(['INACTIVE', 'deleted', 'system'] as const)(
    'rejects %s users for issuance, refresh and access',
    async (condition) => {
      const initial = await sessions.create(user);
      if (condition === 'INACTIVE') user.status = UserStatus.INACTIVE;
      if (condition === 'deleted') user.deletedAt = new Date();
      if (condition === 'system') user.id = SYSTEM_USER_ID;
      await expect(sessions.create(user)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(sessions.refresh(initial.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload(initial.access_token))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it('rejects expired JWTs and expired database sessions', async () => {
    const expired = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: 'refresh-test-secret',
        expiresIn: -1,
      },
    );
    user.refreshToken = expired;
    await expect(sessions.refresh(expired)).rejects.toBeInstanceOf(UnauthorizedException);
    const current = await sessions.create(user);
    rows.get(payload(current.refresh_token).sid!)!.expiresAt = new Date(0);
    await expect(sessions.refresh(current.refresh_token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strategy.validate(payload(current.access_token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('keeps database outages distinguishable from invalid credentials', async () => {
    const initial = await sessions.create(user);
    const unavailable = new Error('database unavailable');
    jest.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(unavailable);
    await expect(auth.refreshToken(initial.refresh_token)).rejects.toBe(unavailable);
  });

  it('admin setup creates a refresh-secret signed session inside its transaction', async () => {
    users.clear();
    const setup = new SetupService(prisma, sessions);
    const result = await setup.setupSuperAdmin({
      email: 'setup@example.com',
      firstName: 'Setup',
      lastName: 'Admin',
      password: 'setup-password',
    });
    expect(
      jwt.verify<JwtPayload>(result.refresh_token, { secret: 'refresh-test-secret' }).sid,
    ).toBeDefined();
    expect(() => jwt.verify(result.refresh_token, { secret: 'access-test-secret' })).toThrow();
    expect(rows.size).toBe(1);
    await sessions.refresh(result.refresh_token);
  });
});
