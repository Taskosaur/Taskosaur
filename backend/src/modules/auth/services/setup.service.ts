import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SetupAdminDto } from '../dto/setup-admin.dto';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { AuthSessionService } from './auth-session.service';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private static setupInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async isSetupRequired(): Promise<boolean> {
    const userCount = await this.prisma.user.count();
    return userCount === 0;
  }

  async setupSuperAdmin(setupAdminDto: SetupAdminDto): Promise<AuthResponseDto> {
    if (SetupService.setupInProgress) {
      throw new ConflictException('Setup is already in progress');
    }

    SetupService.setupInProgress = true;

    try {
      return await this.prisma.$transaction(async (prismaTransaction): Promise<AuthResponseDto> => {
        // Double-check no users exist
        const userCount = await prismaTransaction.user.count();
        if (userCount > 0) {
          throw new ConflictException('System setup has already been completed');
        }

        this.logger.log('Starting system setup...');

        const existingUser = await prismaTransaction.user.findUnique({
          where: { email: setupAdminDto.email },
        });
        if (existingUser) {
          throw new ConflictException('User with this email already exists');
        }

        // Unique username generation
        const baseUsername = setupAdminDto.email.split('@')[0].toLowerCase();
        let finalUsername = baseUsername;
        let counter = 1;
        while (
          await prismaTransaction.user.findUnique({
            where: { username: finalUsername },
          })
        ) {
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(setupAdminDto.password, 12);

        // Create super admin user
        const user = await prismaTransaction.user.create({
          data: {
            email: setupAdminDto.email,
            username: finalUsername,
            firstName: setupAdminDto.firstName,
            lastName: setupAdminDto.lastName,
            password: hashedPassword,
            role: Role.SUPER_ADMIN,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            bio: 'System Super Administrator',
            timezone: 'UTC',
            language: 'en',
            preferences: {
              setup_admin: true,
              created_during_setup: true,
              auto_verified: true,
            },
          },
        });

        const tokens = await this.authSessionService.create(user, prismaTransaction);

        return {
          ...tokens,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            username: user.username || undefined,
            avatar: user.avatar || undefined,
            bio: user.bio || undefined,
            mobileNumber: user.mobileNumber || undefined,
            language: user.language || undefined,
            timezone: user.timezone || undefined,
          },
        };
      });
    } catch (error) {
      this.logger.error('Setup failed:', error);
      throw error;
    } finally {
      SetupService.setupInProgress = false;
    }
  }

  async validateSetupState(): Promise<{ canSetup: boolean; message?: string }> {
    if (SetupService.setupInProgress) {
      return {
        canSetup: false,
        message: 'Setup is currently in progress',
      };
    }

    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      return {
        canSetup: false,
        message: 'System setup has already been completed',
      };
    }

    return { canSetup: true };
  }
}
