import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemUserSeederService } from '../../../seeder/system-user.seeder.service';
import { SetupAdminDto } from '../dto/setup-admin.dto';
import { User, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private static setupInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemUserSeeder: SystemUserSeederService,
  ) { }

  async isSetupRequired(): Promise<boolean> {
    const userCount = await this.prisma.user.count();
    return userCount === 0;
  }

  async setupSuperAdmin(
    setupAdminDto: SetupAdminDto,
  ): Promise<Omit<User, 'password'>> {
    // Prevent concurrent setup attempts
    if (SetupService.setupInProgress) {
      throw new ConflictException('Setup is already in progress');
    }

    SetupService.setupInProgress = true;

    try {
      return await this.prisma.$transaction(async (prismaTransaction) => {
        // Double-check no users exist within transaction
        const userCount = await prismaTransaction.user.count();
        if (userCount > 0) {
          throw new ConflictException(
            'System setup has already been completed',
          );
        }

        this.logger.log('Starting system setup...');

        // First, run the SystemUserSeederService to create the system user
        this.logger.log('Creating system user...');
        await this.systemUserSeeder.seed();

        // Then create the super admin
        this.logger.log('Creating super admin...');

        // Check if email already exists (should not happen in fresh setup, but safety check)
        const existingUser = await prismaTransaction.user.findUnique({
          where: { email: setupAdminDto.email },
        });

        if (existingUser) {
          throw new ConflictException('User with this email already exists');
        }

        // Check username if provided
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

        // Create super admin
        const superAdmin = await prismaTransaction.user.create({
          data: {
            email: setupAdminDto.email,
            username: finalUsername,
            firstName: setupAdminDto.firstName,
            lastName: setupAdminDto.lastName,
            password: hashedPassword,
            role: Role.SUPER_ADMIN,
            status: UserStatus.ACTIVE,
            emailVerified: true, // Auto-verify super admin
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

        this.logger.log(
          `Super admin created successfully: ${superAdmin.email}`,
        );

        const { password, ...superAdminWithoutPassword } = superAdmin;
        return superAdminWithoutPassword;
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
