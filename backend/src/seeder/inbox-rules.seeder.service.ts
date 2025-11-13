import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InboxRulesSeederService {
  private readonly logger = new Logger(InboxRulesSeederService.name);

  constructor(private prisma: PrismaService) {}

  async seedDefaultInboxRules(projectInboxId: string, userId?: string) {
    this.logger.log(`Seeding default inbox rules for inbox: ${projectInboxId}`);

    const defaultRules = [
      {
        name: 'High Priority - Urgent Keywords',
        description: 'Automatically set high priority for emails containing urgent keywords',
        priority: 10,
        enabled: true,
        conditions: {
          any: [
            {
              subject: {
                contains: 'URGENT',
              },
            },
            {
              subject: {
                contains: 'CRITICAL',
              },
            },
            {
              subject: {
                contains: 'EMERGENCY',
              },
            },
            {
              body: {
                contains: 'asap',
              },
            },
          ],
        },
        actions: {
          setPriority: 'HIGH',
          addLabels: ['urgent'],
        },
        stopOnMatch: false,
      },
      {
        name: 'Bug Report Detection',
        description: 'Detect and categorize bug reports',
        priority: 8,
        enabled: true,
        conditions: {
          any: [
            {
              subject: {
                contains: 'bug',
              },
            },
            {
              subject: {
                contains: 'error',
              },
            },
            {
              subject: {
                contains: 'broken',
              },
            },
            {
              subject: {
                contains: 'not working',
              },
            },
            {
              body: {
                contains: 'stack trace',
              },
            },
          ],
        },
        actions: {
          setPriority: 'HIGH',
          addLabels: ['bug', 'technical'],
          assignTo: userId || null,
        },
        stopOnMatch: false,
      },
      {
        name: 'Feature Request',
        description: 'Categorize feature requests and enhancement suggestions',
        priority: 5,
        enabled: true,
        conditions: {
          any: [
            {
              subject: {
                contains: 'feature',
              },
            },
            {
              subject: {
                contains: 'enhancement',
              },
            },
            {
              subject: {
                contains: 'suggestion',
              },
            },
            {
              subject: {
                contains: 'improvement',
              },
            },
            {
              body: {
                contains: 'would be nice',
              },
            },
            {
              body: {
                contains: 'can you add',
              },
            },
          ],
        },
        actions: {
          setPriority: 'MEDIUM',
          addLabels: ['feature-request', 'enhancement'],
        },
        stopOnMatch: false,
      },
      {
        name: 'VIP Customer Priority',
        description: 'High priority for VIP customer domains',
        priority: 9,
        enabled: false, // Disabled by default, users need to configure their VIP domains
        conditions: {
          any: [
            {
              from: {
                matches: '@enterprise-client.com',
              },
            },
            {
              from: {
                matches: '@vip-customer.com',
              },
            },
          ],
        },
        actions: {
          setPriority: 'HIGHEST',
          addLabels: ['vip', 'enterprise'],
          assignTo: userId || null,
        },
        stopOnMatch: false,
      },
      {
        name: 'Support Question',
        description: 'Standard support questions with medium priority',
        priority: 3,
        enabled: true,
        conditions: {
          any: [
            {
              subject: {
                contains: 'how to',
              },
            },
            {
              subject: {
                contains: 'help',
              },
            },
            {
              subject: {
                contains: 'question',
              },
            },
            {
              subject: {
                contains: 'support',
              },
            },
            {
              body: {
                contains: 'can you help',
              },
            },
          ],
        },
        actions: {
          setPriority: 'MEDIUM',
          addLabels: ['support', 'question'],
        },
        stopOnMatch: false,
      },
      {
        name: 'Auto-Reply for New Requests',
        description: 'Send automatic acknowledgment for new support requests',
        priority: 1,
        enabled: true,
        conditions: {
          all: [
            {
              subject: {
                matches: '^(?!Re:).*',
              },
            },
          ],
        },
        actions: {
          autoReply:
            'Thank you for contacting us. We have received your request and will respond within 24 hours during business days. For urgent matters, please call our support line.',
        },
        stopOnMatch: false,
      },
      {
        name: 'Spam Detection - Common Patterns',
        description: 'Detect common spam patterns and mark as spam',
        priority: 15,
        enabled: true,
        conditions: {
          any: [
            {
              subject: {
                contains: 'CONGRATULATIONS',
              },
            },
            {
              subject: {
                contains: 'You have won',
              },
            },
            {
              subject: {
                contains: 'Click here now',
              },
            },
            {
              subject: {
                contains: 'Limited time offer',
              },
            },
            {
              from: {
                contains: 'noreply@suspicious',
              },
            },
          ],
        },
        actions: {
          markAsSpam: true,
        },
        stopOnMatch: true,
      },
      {
        name: 'Out of Office Detection',
        description: 'Detect and ignore out of office auto-replies',
        priority: 12,
        enabled: true,
        conditions: {
          any: [
            {
              subject: {
                contains: 'Out of Office',
              },
            },
            {
              subject: {
                contains: 'Auto Reply',
              },
            },
            {
              subject: {
                contains: 'Automatic Reply',
              },
            },
            {
              body: {
                contains: 'I am currently out of the office',
              },
            },
          ],
        },
        actions: {
          markAsSpam: false,
          setPriority: 'LOWEST',
          addLabels: ['auto-reply', 'out-of-office'],
        },
        stopOnMatch: true,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const rule of defaultRules) {
      try {
        // Check if rule already exists by name for this inbox
        const existing = await this.prisma.inboxRule.findFirst({
          where: {
            projectInboxId,
            name: rule.name,
          },
        });

        if (existing) {
          this.logger.debug(`Rule "${rule.name}" already exists for this inbox, skipping`);
          skipped++;
          continue;
        }

        await this.prisma.inboxRule.create({
          data: {
            ...rule,
            projectInboxId,
          },
        });

        this.logger.debug(`Created rule: ${rule.name}`);
        created++;
      } catch (_error) {
        this.logger.error(`Failed to create rule "${rule.name}":`, _error.message);
      }
    }

    this.logger.log(`Inbox rules seeding completed: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  }

  async seedRulesForAllInboxes() {
    this.logger.log('Seeding default rules for all existing inboxes...');

    const inboxes = await this.prisma.projectInbox.findMany({
      include: {
        project: {
          include: {
            members: {
              take: 1,
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const inbox of inboxes) {
      const userId = inbox.project.members[0]?.user?.id; // Use first project member as default assignee
      const result = await this.seedDefaultInboxRules(inbox.id, userId);
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }

    this.logger.log(
      `Total rules seeded: ${totalCreated} created, ${totalSkipped} skipped across ${inboxes.length} inboxes`,
    );
    return { totalCreated, totalSkipped, inboxesProcessed: inboxes.length };
  }
}
