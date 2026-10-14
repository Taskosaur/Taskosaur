import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '@prisma/client';
import { AuthSessionService } from '../services/auth-session.service';
import { SYSTEM_USER_ID } from '../../../common/constants';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  sid?: string;
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Password login already refuses an account that is not ACTIVE, but every
    // request authenticated by a token has to make the same check. Without it,
    // a token issued before an administrator deactivated the account keeps
    // working until it expires, so deactivation does not take effect when it is
    // most likely to matter: offboarding, an incident, a policy action.
    if (user.status !== UserStatus.ACTIVE || user.deletedAt || user.id === SYSTEM_USER_ID) {
      throw new UnauthorizedException('Account is not active');
    }

    if (
      payload.sid !== undefined &&
      !(await this.authSessionService.isActive(payload.sid, user.id))
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      sid: payload.sid,
    };
  }
}
