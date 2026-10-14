import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { SetupService } from './services/setup.service';
import { OidcService } from './services/oidc.service';
import { AuthSessionService } from './services/auth-session.service';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccessControlService } from 'src/common/access-control.utils';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    EmailModule,
    SettingsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    JwtStrategy,
    LocalStrategy,
    SetupService,
    OidcService,
    AccessControlService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
