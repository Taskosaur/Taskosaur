import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus, UserSource, User } from '@prisma/client';

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class SystemUserSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(): Promise<User> {
    console.log('🤖 Seeding system user...');

    try {
      // Check if system user already exists
      const existing = await this.prisma.user.findUnique({
        where: { id: SYSTEM_USER_ID },
      });

      if (existing) {
        console.log('   ✓ System user already exists');
        return existing;
      }

      // Create system user
      const systemUser = await this.prisma.user.create({
        data: {
          id: SYSTEM_USER_ID,
          email: 'system@taskosaur.internal',
          username: 'system',
          firstName: 'System',
          lastName: 'User',
          role: Role.SUPER_ADMIN,
          status: UserStatus.INACTIVE,
          source: UserSource.MANUAL, // Add this field
          password: null,
          emailVerified: false,
          bio: 'Internal system user for audit trails and automated operations. Cannot be used for authentication.',
          timezone: 'UTC',
          language: 'en',
          // All optional null fields can be omitted, but explicitly setting them is fine too
        },
      });

      console.log(`   ✓ Created system user: ${systemUser.email} (ID: ${systemUser.id})`);
      console.log('   ⚠️  System user is INACTIVE and cannot be used for authentication');

      return systemUser;
    } catch (error) {
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
        console.log('   ⚠ System user not found, nothing to clear');
      } else if (error.code === 'P2003') {
        console.error('❌ Cannot delete: System user is referenced by other records');
        console.log('💡 You may need to delete dependent records first or use CASCADE');
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

  async verifySystemUser(): Promise<boolean> {
    const systemUser = await this.findSystemUser();

    if (!systemUser) {
      console.error('❌ System user not found');
      return false;
    }

    const checks = [
      { name: 'Status is INACTIVE', pass: systemUser.status === UserStatus.INACTIVE },
      { name: 'Password is null', pass: systemUser.password === null },
      { name: 'Email not verified', pass: systemUser.emailVerified === false },
      { name: 'Role is SUPER_ADMIN', pass: systemUser.role === Role.SUPER_ADMIN },
      { name: 'Email correct', pass: systemUser.email === 'system@taskosaur.internal' },
    ];

    const allPassed = checks.every((c) => c.pass);

    checks.forEach((check) => {
      const icon = check.pass ? '✅' : '❌';
      console.log(`   ${icon} ${check.name}`);
    });

    if (allPassed) {
      console.log('✅ System user verification passed');
    } else {
      console.log('❌ System user verification failed');
    }

    return allPassed;
  }
}
