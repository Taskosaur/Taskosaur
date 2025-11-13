import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersSeederService {
  constructor(private prisma: PrismaService) {}

  async seed() {
    console.log('🌱 Seeding users...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const usersData = [
      {
        email: 'admin@taskosaur.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'System administrator with full access to all features',
        timezone: 'UTC',
        language: 'en',
        mobileNumber: '+10000000001',
      },
      {
        email: 'john.doe@taskosaur.com',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        role: Role.MEMBER,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'Senior Frontend Developer specializing in React and TypeScript',
        timezone: 'America/New_York',
        language: 'en',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        mobileNumber: '+10000000002',
      },
      {
        email: 'jane.smith@taskosaur.com',
        username: 'janesmith',
        firstName: 'Jane',
        lastName: 'Smith',
        role: Role.MANAGER,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'Product Manager with 8+ years of experience in agile development',
        timezone: 'America/Los_Angeles',
        language: 'en',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b606?w=150',
        mobileNumber: '+10000000003',
      },
      {
        email: 'mike.wilson@taskosaur.com',
        username: 'mikewilson',
        firstName: 'Mike',
        lastName: 'Wilson',
        role: Role.MEMBER,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'Backend Developer focused on Node.js, NestJS, and PostgreSQL',
        timezone: 'Europe/London',
        language: 'en',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        mobileNumber: '+10000000004',
      },
      {
        email: 'sarah.jones@taskosaur.com',
        username: 'sarahjones',
        firstName: 'Sarah',
        lastName: 'Jones',
        role: Role.MEMBER,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'UI/UX Designer passionate about creating intuitive user experiences',
        timezone: 'Australia/Sydney',
        language: 'en',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
        mobileNumber: '+10000000005',
      },
      {
        email: 'alex.brown@taskosaur.com',
        username: 'alexbrown',
        firstName: 'Alex',
        lastName: 'Brown',
        role: Role.MEMBER,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'DevOps Engineer specializing in cloud infrastructure and automation',
        timezone: 'America/Chicago',
        language: 'en',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        mobileNumber: '+10000000006',
      },
      {
        email: 'emma.davis@taskosaur.com',
        username: 'emmadavis',
        firstName: 'Emma',
        lastName: 'Davis',
        role: Role.VIEWER,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'QA Analyst ensuring quality across all product features',
        timezone: 'Europe/Berlin',
        language: 'en',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        mobileNumber: '+10000000007',
      },
      {
        email: 'tom.garcia@taskosaur.com',
        username: 'tomgarcia',
        firstName: 'Tom',
        lastName: 'Garcia',
        role: Role.MEMBER,
        status: UserStatus.PENDING,
        password: hashedPassword,
        emailVerified: false,
        bio: 'Junior Developer eager to learn and contribute',
        timezone: 'America/Denver',
        language: 'en',
        mobileNumber: '+10000000008',
      },
    ];

    const createdUsers: User[] = [];
    for (const userData of usersData) {
      try {
        const user = await this.prisma.user.create({
          data: {
            ...userData,
            preferences: {
              theme: 'light',
              notifications: {
                email: true,
                push: true,
                desktop: true,
              },
              dashboard: {
                showCompletedTasks: false,
                defaultView: 'list',
              },
            },
          },
        });
        createdUsers.push(user);
        console.log(`   ✓ Created user: ${user.email}`);
      } catch (error) {
        console.error(error);
        console.log(`   ⚠ User ${userData.email} might already exist, skipping...`);
        // Try to find existing user
        const existingUser = await this.prisma.user.findUnique({
          where: { email: userData.email },
        });
        if (existingUser) {
          createdUsers.push(existingUser);
        }
      }
    }

    console.log(`✅ Users seeding completed. Created/Found ${createdUsers.length} users.`);
    return createdUsers;
  }

  async clear() {
    console.log('🧹 Clearing users...');

    try {
      const deletedCount = await this.prisma.user.deleteMany();
      console.log(`✅ Deleted ${deletedCount.count} users`);
    } catch (_error) {
      console.error('❌ Error clearing users:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        mobileNumber: true,
        timezone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
