import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus, User, Organization } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_WORKFLOW,
  DEFAULT_TASK_STATUSES,
  DEFAULT_STATUS_TRANSITIONS,
} from '../constants/defaultWorkflow';

@Injectable()
export class AdminSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(): Promise<User | null> {
    console.log('🌱 Seeding admin user...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const adminUserData = {
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
    };

    let adminUser: User | null = null;

    try {
      adminUser = await this.prisma.user.create({
        data: {
          ...adminUserData,
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
      console.log(`   ✓ Created admin user: ${adminUser.email}`);
    } catch (error) {
      console.error(error);
      console.log(`   ⚠ Admin user ${adminUserData.email} might already exist, skipping...`);
      adminUser = await this.prisma.user.findUnique({
        where: { email: adminUserData.email },
      });
    }

    // ✅ Create Default Organization
    if (adminUser) {
      await this.seedDefaultOrganization(adminUser);
    }

    console.log('✅ Admin user + default organization seeding completed.');
    return adminUser;
  }

  private async seedDefaultOrganization(adminUser: User): Promise<Organization> {
    console.log('🌱 Seeding default organization...');

    const orgData = {
      name: 'Default Organization',
      slug: 'default-organization',
      description: 'This is the default organization for admin user',
      website: 'https://example.com',
      avatar: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=150',
      ownerId: adminUser.id,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
      settings: {
        allowPublicSignup: false,
        defaultUserRole: 'MEMBER',
        requireEmailVerification: true,
        enableTimeTracking: true,
        enableAutomation: true,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        workingHours: {
          start: '09:00',
          end: '17:00',
        },
        timezone: 'UTC',
      },
    };

    // Check if organization already exists
    const organization = await this.prisma.organization.findUnique({
      where: { slug: orgData.slug },
      include: {
        workflows: {
          where: { isDefault: true },
          include: { statuses: true },
        },
      },
    });

    if (organization) {
      console.log(`   ✓ Organization already exists: ${organization.name}`);
      return organization;
    }

    try {
      const createdOrganization = await this.prisma.organization.create({
        data: {
          ...orgData,
          workflows: {
            create: {
              name: DEFAULT_WORKFLOW.name,
              description: DEFAULT_WORKFLOW.description,
              isDefault: true,
              createdBy: orgData.createdBy,
              updatedBy: orgData.updatedBy,
              statuses: {
                create: DEFAULT_TASK_STATUSES.map((status) => ({
                  name: status.name,
                  color: status.color,
                  category: status.category,
                  position: status.position,
                  isDefault: status.isDefault,
                  createdBy: orgData.createdBy,
                  updatedBy: orgData.updatedBy,
                })),
              },
            },
          },
        },
        include: {
          workflows: {
            where: { isDefault: true },
            include: { statuses: true },
          },
        },
      });

      // create transitions
      const defaultWorkflow = createdOrganization.workflows[0];
      if (defaultWorkflow?.statuses?.length > 0) {
        await this.createDefaultStatusTransitions(
          defaultWorkflow.id,
          defaultWorkflow.statuses,
          orgData.createdBy,
        );
        console.log(
          `   ✓ Created default workflow and transitions for: ${createdOrganization.name}`,
        );
      }

      console.log(`   ✓ Created organization: ${createdOrganization.name}`);
      return createdOrganization;
    } catch (_error) {
      console.error(`   ❌ Error creating organization: ${_error.message}`);
      throw _error;
    }
  }

  private async createDefaultStatusTransitions(
    workflowId: string,
    statuses: any[],
    userId: string,
  ) {
    const statusMap = new Map(statuses.map((s) => [s.name, s.id]));
    const transitionsToCreate = DEFAULT_STATUS_TRANSITIONS.filter(
      (t) => statusMap.has(t.from) && statusMap.has(t.to),
    ).map((t) => ({
      name: `${t.from} → ${t.to}`,
      workflowId,
      fromStatusId: statusMap.get(t.from),
      toStatusId: statusMap.get(t.to),
      createdBy: userId,
      updatedBy: userId,
    }));

    if (transitionsToCreate.length > 0) {
      await this.prisma.statusTransition.createMany({
        data: transitionsToCreate,
        skipDuplicates: true, // Skip if already exists
      });
    }
  }

  async clear() {
    console.log('🧹 Clearing admin user(s) and default organization...');

    try {
      await this.prisma.statusTransition.deleteMany();
      await this.prisma.taskStatus.deleteMany();
      await this.prisma.workflow.deleteMany();
      await this.prisma.organizationMember.deleteMany();
      await this.prisma.organization.deleteMany();

      const deletedCount = await this.prisma.user.deleteMany({
        where: { role: Role.SUPER_ADMIN },
      });
      console.log(`✅ Deleted ${deletedCount.count} admin user(s)`);
    } catch (_error) {
      console.error('❌ Error clearing admin + organization:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN },
      include: {
        ownedOrganizations: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }
}
