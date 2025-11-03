import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus, User } from '@prisma/client';

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class SystemUserSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(): Promise<User> {
    console.log('🤖 Seeding system user...');

    const systemUserData = {
      id: SYSTEM_USER_ID,
      email: 'system@taskosaur.internal',
      username: 'system',
      firstName: 'System',
      lastName: 'User',
      role: Role.SUPER_ADMIN,
      status: UserStatus.INACTIVE, // Cannot be used for authentication
      password: null, // No password - cannot authenticate
      emailVerified: false,
      bio: 'Internal system user for audit trails and automated operations. Cannot be used for authentication.',
      timezone: 'UTC',
      language: 'en',
      avatar: null,
      refreshToken: null,
      resetToken: null,
      resetTokenExpiry: null,
      lastLoginAt: null,
      preferences: {
        system: true,
        internal: true,
        audit_only: true,
      },
    };

    try {
      // Try to create the system user
      const systemUser = await this.prisma.user.create({
        data: systemUserData,
      });

      console.log(`   ✓ Created system user: ${systemUser.email} (ID: ${systemUser.id})`);
      console.log('   ⚠️  System user is INACTIVE and cannot be used for authentication');

      return systemUser;
    } catch (error) {
      // If user already exists, try to find and return it
      if (error.code === 'P2002') {
        // Unique constraint violation
        console.log('   ⚠ System user already exists, fetching existing user...');

        const existingUser = await this.prisma.user.findUnique({
          where: { id: SYSTEM_USER_ID },
        });

        if (existingUser) {
          console.log(`   ✓ Found existing system user: ${existingUser.email}`);
          return existingUser;
        }
      }

      console.error('❌ Error creating system user:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    console.log('🧹 Clearing system user...');

    try {
      const deletedUser = await this.prisma.user.delete({
        where: { id: SYSTEM_USER_ID },
      });

      console.log(`✅ Deleted system user: ${deletedUser.email}`);
    } catch (error) {
      if (error.code === 'P2025') {
        // Record not found
        console.log('   ⚠ System user not found, nothing to clear');
      } else {
        console.error('❌ Error clearing system user:', error);
        throw error;
      }
    }
  }

  async findSystemUser(): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: SYSTEM_USER_ID },
    });
  }

  /**
   * Verify that the system user exists and has correct properties
   */
  async verifySystemUser(): Promise<boolean> {
    const systemUser = await this.findSystemUser();

    if (!systemUser) {
      console.error('❌ System user not found');
      return false;
    }

    const issues: string[] = [];

    if (systemUser.status !== UserStatus.INACTIVE) {
      issues.push('Status should be INACTIVE');
    }

    if (systemUser.password !== null) {
      issues.push('Password should be null');
    }

    if (systemUser.emailVerified !== false) {
      issues.push('Email should not be verified');
    }

    if (issues.length > 0) {
      console.error('❌ System user verification failed:');
      issues.forEach((issue) => console.error(`   - ${issue}`));
      return false;
    }

    console.log('✅ System user verification passed');
    return true;
  }
}
