import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma, User, UserStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { SYSTEM_USER_ID } from '../../../common/constants';
import { PrismaService } from '../../../prisma/prisma.service';
import type { JwtPayload } from '../strategies/jwt.strategy';

type SessionUser = Pick<User, 'id' | 'email' | 'role' | 'status' | 'deletedAt'>;

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private assertEligible(user: SessionUser | null): asserts user is SessionUser {
    if (
      !user ||
      user.id === SYSTEM_USER_ID ||
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt
    ) {
      throw new UnauthorizedException('Account is not active');
    }
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokens(user: SessionUser, sessionId: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as JwtSignOptions['expiresIn'],
      },
    );
    const decoded = this.jwtService.decode<JwtPayload>(refreshToken);
    if (typeof decoded.exp !== 'number') {
      throw new Error('Refresh token expiration is required');
    }
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiresAt: new Date(decoded.exp * 1000),
    };
  }

  async create(user: SessionUser, prisma: Prisma.TransactionClient = this.prisma) {
    this.assertEligible(user);
    const sessionId = randomUUID();
    const tokens = this.tokens(user, sessionId);
    await prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hash(tokens.refresh_token),
        expiresAt: tokens.expiresAt,
      },
    });
    return { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
  }

  private verify(token: string): JwtPayload {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub) ||
      typeof payload.exp !== 'number' ||
      (payload.sid !== undefined && (typeof payload.sid !== 'string' || !isUUID(payload.sid)))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return payload;
  }

  async refresh(token: string) {
    const payload = this.verify(token);
    if (!payload.sid) {
      // Adopt only the exact legacy token still allowed by the old account row.
      // Clearing it and creating its replacement must commit together.
      return this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        this.assertEligible(user);
        const claimed = await prisma.user.updateMany({
          where: {
            id: user.id,
            refreshToken: token,
            status: UserStatus.ACTIVE,
            deletedAt: null,
          },
          data: { refreshToken: null },
        });
        if (claimed.count !== 1) {
          throw new UnauthorizedException('Invalid refresh token');
        }
        return { ...(await this.create(user, prisma)), user };
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    this.assertEligible(user);
    const tokens = this.tokens(user, payload.sid);
    // Atomic compare-and-swap makes a refresh token usable only once.
    const rotated = await this.prisma.authSession.updateMany({
      where: {
        id: payload.sid,
        userId: user.id,
        refreshTokenHash: this.hash(token),
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: this.hash(tokens.refresh_token),
        expiresAt: tokens.expiresAt,
      },
    });
    if (rotated.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user,
    };
  }

  async isActive(sessionId: string, userId: string): Promise<boolean> {
    if (!isUUID(sessionId)) return false;
    return !!(await this.prisma.authSession.findFirst({
      where: { id: sessionId, userId, expiresAt: { gt: new Date() } },
      select: { id: true },
    }));
  }

  async revoke(userId: string, sessionId?: string, refreshToken?: string): Promise<boolean> {
    if (sessionId) {
      await this.prisma.authSession.deleteMany({ where: { id: sessionId, userId } });
    } else if (refreshToken) {
      await this.prisma.user.updateMany({
        where: { id: userId, refreshToken },
        data: { refreshToken: null },
      });
    }
    if (!refreshToken) return false;
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        ignoreExpiration: true,
      });
      return payload.sub === userId && payload.sid === sessionId;
    } catch {
      return false;
    }
  }
}
