import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role as OrganizationRole, Organization } from '@prisma/client';
import {
  DEFAULT_WORKFLOW,
  DEFAULT_TASK_STATUSES,
  DEFAULT_STATUS_TRANSITIONS,
} from '../constants/defaultWorkflow';

@Injectable()
export class OrganizationsSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(users: any[]) {
    console.log('🌱 Seeding organizations...');

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before organizations');
    }

    // Find admin/super admin user to be owner
    const adminUser =
      users.find((user) => user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') || users[0];

    const organizationsData = [
      {
        name: 'Taskosaur Inc.',
        slug: 'taskosaur-inc',
        description: 'A comprehensive task management solution for modern teams',
        website: 'https://taskosaur.com',
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
      },
      {
        name: 'Tech Innovators LLC',
        slug: 'tech-innovators',
        description: 'Innovation-driven technology consultancy',
        website: 'https://techinnovators.example.com',
        avatar: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150',
        ownerId: adminUser.id,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
        settings: {
          allowPublicSignup: true,
          defaultUserRole: 'VIEWER',
          requireEmailVerification: true,
          enableTimeTracking: false,
          enableAutomation: false,
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          workingHours: {
            start: '08:30',
            end: '16:30',
          },
          timezone: 'America/New_York',
        },
      },
    ];

    const createdOrganizations: Organization[] = [];

    for (const orgData of organizationsData) {
      // Check if organization already exists
      let organization = await this.prisma.organization.findUnique({
        where: { slug: orgData.slug },
        include: {
          workflows: {
            where: { isDefault: true },
            include: {
              statuses: {
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      });

      if (organization) {
        console.log(`   ✓ Organization already exists: ${organization.name}`);
        createdOrganizations.push(organization);
        // Still try to add members in case they're missing
        await this.addMembersToOrganization(organization.id, users);
        continue;
      }

      try {
        // Create organization with default workflow and task statuses
        organization = await this.prisma.organization.create({
          data: {
            ...orgData,
            // Create default workflow with task statuses
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
              include: {
                statuses: {
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        });

        // Create status transitions after organization is created
        const defaultWorkflow = organization.workflows[0];
        if (defaultWorkflow?.statuses && defaultWorkflow.statuses.length > 0) {
          await this.createDefaultStatusTransitions(
            defaultWorkflow.id,
            defaultWorkflow.statuses as any[],
            orgData.createdBy as string,
          );
          console.log(`   ✓ Created default workflow and transitions for: ${organization.name}`);
        }

        // Add organization members
        await this.addMembersToOrganization(organization.id, users);

        createdOrganizations.push(organization);
        console.log(`   ✓ Created organization: ${organization.name}`);
      } catch (_error) {
        console.error(`   ❌ Error creating organization ${orgData.slug}: ${_error.message}`);
      }
    }

    console.log(
      `✅ Organizations seeding completed. Created/Found ${createdOrganizations.length} organizations.`,
    );
    return createdOrganizations;
  }

  // Helper method to create status transitions
  private async createDefaultStatusTransitions(
    workflowId: string,
    statuses: any[],
    userId: string,
  ) {
    // Create a map of status names to IDs
    const statusMap = new Map(statuses.map((status) => [status.name, status.id]));

    const transitionsToCreate = DEFAULT_STATUS_TRANSITIONS.filter(
      (transition) => statusMap.has(transition.from) && statusMap.has(transition.to),
    ).map((transition) => ({
      name: `${transition.from} → ${transition.to}`,
      workflowId,
      fromStatusId: statusMap.get(transition.from),
      toStatusId: statusMap.get(transition.to),
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

  private async addMembersToOrganization(organizationId: string, users: any[]) {
    // Define roles for users (first user is owner, already created)
    const memberRoles = [
      OrganizationRole.OWNER, // Second user
      OrganizationRole.MANAGER, // Third user
      OrganizationRole.MEMBER, // Fourth user
      OrganizationRole.MEMBER, // Fifth user
      OrganizationRole.MEMBER, // Sixth user
      OrganizationRole.VIEWER, // Seventh user
      OrganizationRole.MEMBER, // Eighth user (if exists)
    ];

    // Skip the first user (owner) and add the rest as members
    for (let i = 1; i < users.length && i <= memberRoles.length; i++) {
      // Check if member already exists
      const existingMember = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: users[i].id,
            organizationId,
          },
        },
      });

      if (existingMember) {
        console.log(`   ✓ User ${users[i].email} is already a member`);
        continue;
      }

      try {
        await this.prisma.organizationMember.create({
          data: {
            userId: users[i].id,
            organizationId,
            role: memberRoles[i - 1],
          },
        });
        console.log(`   ✓ Added ${users[i].email} to organization as ${memberRoles[i - 1]}`);
      } catch (_error) {
        console.error(_error);
        console.log(`   ⚠ Could not add ${users[i].email}: ${_error.message}`);
      }
    }
  }

  async clear() {
    console.log('🧹 Clearing organizations...');

    try {
      // Delete in correct order due to foreign key constraints
      console.log('   🧹 Deleting status transitions...');
      await this.prisma.statusTransition.deleteMany();

      console.log('   🧹 Deleting task statuses...');
      await this.prisma.taskStatus.deleteMany();

      console.log('   🧹 Deleting workflows...');
      await this.prisma.workflow.deleteMany();

      console.log('   🧹 Deleting organization members...');
      const deletedMembers = await this.prisma.organizationMember.deleteMany();
      console.log(`   ✓ Deleted ${deletedMembers.count} organization members`);

      console.log('   🧹 Deleting organizations...');
      const deletedOrgs = await this.prisma.organization.deleteMany();
      console.log(`✅ Deleted ${deletedOrgs.count} organizations`);
    } catch (_error) {
      console.error('❌ Error clearing organizations:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        website: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        workflows: {
          where: { isDefault: true },
          select: {
            id: true,
            name: true,
            isDefault: true,
            statuses: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
                position: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        },
        members: {
          select: {
            role: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            workspaces: true,
          },
        },
        createdAt: true,
      },
    });
  }
}
