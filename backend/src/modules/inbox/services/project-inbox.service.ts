import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/crypto.service';
import {
  CreateInboxDto,
  UpdateInboxDto,
  SetupEmailDto,
  MessageFiltersDto,
  CreateRuleDto,
} from '../dto';
import { MessageStatus, Prisma } from '@prisma/client';
@Injectable()
export class ProjectInboxService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async createInbox(projectId: string, data: CreateInboxDto) {
    // Check if project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if inbox already exists for this project
    const existingInbox = await this.prisma.projectInbox.findUnique({
      where: { projectId },
    });
    if (existingInbox) {
      return existingInbox;
    }

    // Check if email address is already in use by another project
    if (data.emailAddress) {
      const existingEmailInbox = await this.prisma.projectInbox.findUnique({
        where: { emailAddress: data.emailAddress },
      });
      if (existingEmailInbox) {
        throw new BadRequestException(
          `Email address ${data.emailAddress} is already in use by another project inbox`,
        );
      }
    }

    const synncInterval = data.syncInterval ? parseInt(data.syncInterval, 10) : 5;
    return this.prisma.projectInbox.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        emailAddress: data.emailAddress,
        emailSignature: data.emailSignature,
        autoReplyEnabled: data.autoReplyEnabled ?? false,
        autoReplyTemplate: data.autoReplyTemplate,
        autoCreateTask: data.autoCreateTask ?? true,
        defaultTaskType: data.defaultTaskType,
        defaultPriority: data.defaultPriority,
        defaultStatusId: data.defaultStatusId,
        syncInterval: synncInterval,
        defaultAssigneeId: data.defaultAssigneeId,
      },
      include: {
        project: true,
        defaultStatus: true,
        defaultAssignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        emailAccount: true,
      },
    });
  }

  async getInbox(projectId: string) {
    const inbox = await this.prisma.projectInbox.findUnique({
      where: { projectId },
      include: {
        project: true,
        defaultStatus: true,
        defaultAssignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        emailAccount: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            syncEnabled: true,
            lastSyncAt: true,
            lastSyncError: true,
            imapHost: true,
            imapPort: true,
            imapUseSsl: true,
            imapServername: true,
            smtpHost: true,
            smtpPort: true,
            smtpServername: true,
            smtpRequireTls: true,
            imapPassword: true,
            smtpUsername: true,
            smtpPassword: true,
            imapUsername: true,
          },
        },
        _count: {
          select: {
            messages: true,
            rules: true,
          },
        },
      },
    });

    // Just return null (don’t throw)
    return inbox ?? null;
  }

  async updateInbox(projectId: string, data: UpdateInboxDto) {
    const inbox = await this.getInbox(projectId);
    if (!inbox) {
      throw new NotFoundException('Inbox not found for this project');
    }

    // Check if email address is already in use by another project (if changing email)
    if (data.emailAddress && data.emailAddress !== inbox.emailAddress) {
      const existingEmailInbox = await this.prisma.projectInbox.findUnique({
        where: { emailAddress: data.emailAddress },
      });
      if (existingEmailInbox && existingEmailInbox.id !== inbox.id) {
        throw new BadRequestException(
          `Email address ${data.emailAddress} is already in use by another project inbox`,
        );
      }
    }

    return this.prisma.projectInbox.update({
      where: { id: inbox.id },
      data: {
        name: data.name,
        description: data.description,
        emailAddress: data.emailAddress,
        emailSignature: data.emailSignature,
        autoReplyEnabled: data.autoReplyEnabled,
        autoReplyTemplate: data.autoReplyTemplate,
        autoCreateTask: data.autoCreateTask,
        defaultTaskType: data.defaultTaskType,
        defaultPriority: data.defaultPriority,
        defaultStatusId: data.defaultStatusId,
        defaultAssigneeId: data.defaultAssigneeId,
      },
      include: {
        project: true,
        defaultStatus: true,
        defaultAssignee: true,
        emailAccount: true,
      },
    });
  }

  async setupEmailAccount(projectId: string, data: SetupEmailDto) {
    const inbox = await this.getInbox(projectId);
    if (!inbox) {
      throw new NotFoundException('Inbox not found for this project');
    }

    // Check if email address is already in use by another project (if changing email)
    if (data.emailAddress && data.emailAddress !== inbox.emailAddress) {
      const existingEmailInbox = await this.prisma.projectInbox.findUnique({
        where: { emailAddress: data.emailAddress },
      });
      if (existingEmailInbox && existingEmailInbox.id !== inbox.id) {
        throw new BadRequestException(
          `Email address ${data.emailAddress} is already in use by another project inbox`,
        );
      }
    }

    // Encrypt sensitive data
    const encryptedData: any = {
      emailAddress: data.emailAddress,
      displayName: data.displayName,
      imapHost: data.imapHost,
      imapPort: data.imapPort,
      imapUsername: data.imapUsername,
      imapUseSsl: data.imapUseSsl,
      imapTlsRejectUnauth: data.imapTlsRejectUnauth,
      imapTlsMinVersion: data.imapTlsMinVersion,
      imapServername: data.imapServername,
      imapFolder: data.imapFolder || 'INBOX',
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpUsername: data.smtpUsername,
      smtpTlsRejectUnauth: data.smtpTlsRejectUnauth,
      smtpTlsMinVersion: data.smtpTlsMinVersion,
      smtpServername: data.smtpServername,
      smtpRequireTls: data.smtpRequireTls,
      syncEnabled: true,
    };

    // Encrypt passwords
    if (data.imapPassword) {
      encryptedData.imapPassword = this.crypto.encrypt(data.imapPassword);
    }
    if (data.smtpPassword) {
      encryptedData.smtpPassword = this.crypto.encrypt(data.smtpPassword);
    }
    await this.prisma.projectInbox.update({
      where: { id: inbox.id },
      data: {
        emailAddress: data.emailAddress,
      },
    });
    return this.prisma.emailAccount.upsert({
      where: { projectInboxId: inbox.id },
      create: {
        projectInboxId: inbox.id,
        ...encryptedData,
      },
      update: encryptedData,
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        syncEnabled: true,
        lastSyncAt: true,
        lastSyncError: true,
        imapHost: true,
        imapPort: true,
        imapUseSsl: true,
        imapServername: true,
        smtpHost: true,
        smtpPort: true,
        smtpServername: true,
        smtpRequireTls: true,
      },
    });
  }

  async getInboxMessages(projectId: string, filters: MessageFiltersDto) {
    const inbox = await this.getInbox(projectId);
    if (!inbox) {
      throw new NotFoundException('Inbox not found for this project');
    }
    const where: Prisma.InboxMessageWhereInput = {
      projectInboxId: inbox.id,
    };

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (!filters.includeSpam) {
      where.isSpam = false;
    }

    if (filters.fromEmail) {
      where.fromEmail = {
        contains: filters.fromEmail,
        mode: 'insensitive',
      };
    }

    if (filters.fromDate || filters.toDate) {
      where.emailDate = {};
      if (filters.fromDate) {
        where.emailDate.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.emailDate.lte = new Date(filters.toDate);
      }
    }

    if (filters.search) {
      where.OR = [
        {
          subject: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          bodyText: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (filters.convertedOnly) {
      where.status = MessageStatus.CONVERTED;
      where.converted = false;
    }

    return this.prisma.inboxMessage.findMany({
      where,
      orderBy: { emailDate: 'desc' },
      include: {
        attachments: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            storageUrl: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            taskNumber: true,
            status: {
              select: { name: true, color: true },
            },
          },
        },
        convertedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getInboxMessage(messageId: string) {
    const message = await this.prisma.inboxMessage.findUnique({
      where: { id: messageId },
      include: {
        projectInbox: true,
        attachments: true,
        task: true,
        convertedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async convertToTask(messageId: string, userId: string) {
    const message = await this.getInboxMessage(messageId);

    if (message.converted) {
      throw new BadRequestException('Message already converted to task');
    }

    // Check for existing thread
    const existingTask = await this.prisma.task.findFirst({
      where: { emailThreadId: message.threadId },
      include: { project: true },
    });

    if (existingTask) {
      // Add as comment to existing task
      await this.prisma.taskComment.create({
        data: {
          taskId: existingTask.id,
          authorId: userId,
          content: message.bodyText || message.bodyHtml || message.subject,
          emailMessageId: message.messageId,
        },
      });

      // Update message status
      await this.prisma.inboxMessage.update({
        where: { id: messageId },
        data: {
          status: MessageStatus.CONVERTED,
          converted: true,
          convertedAt: new Date(),
          convertedBy: userId,
        },
      });

      return existingTask;
    }

    // Create new task
    const taskNumber = await this.getNextTaskNumber(message.projectInbox.projectId);
    const slug = await this.generateTaskSlug(message.subject, message.projectInbox.projectId);

    const task = await this.prisma.task.create({
      data: {
        projectId: message.projectInbox.projectId,
        title: message.subject,
        description: message.bodyText || message.bodyHtml,
        type: message.projectInbox.defaultTaskType,
        priority: message.projectInbox.defaultPriority,
        statusId: message.projectInbox.defaultStatusId,
        emailThreadId: message.threadId,
        allowEmailReplies: true,
        inboxMessageId: message.id,
        taskNumber,
        slug,
        assignees: {
          connect: message.projectInbox.defaultAssigneeId
            ? [{ id: message.projectInbox.defaultAssigneeId }]
            : [],
        },
        reporters: { connect: [{ id: userId }] },
      },
      include: {
        project: true,
        status: true,
        assignees: true,
      },
    });

    // Update message status
    await this.prisma.inboxMessage.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.CONVERTED,
        converted: true,
        convertedAt: new Date(),
        convertedBy: userId,
      },
    });

    // Copy attachments to task if any
    if (message.attachments.length > 0) {
      await this.copyAttachmentsToTask(message.id, task.id);
    }

    return task;
  }

  updateMessageStatus(messageId: string, status: MessageStatus) {
    return this.prisma.inboxMessage.update({
      where: { id: messageId },
      data: { status },
    });
  }

  async createRule(projectId: string, data: CreateRuleDto) {
    const inbox = await this.getInbox(projectId);
    if (!inbox) {
      throw new NotFoundException('Inbox not found for this project');
    }
    return this.prisma.inboxRule.create({
      data: {
        projectInboxId: inbox.id,
        name: data.name,
        description: data.description,
        priority: data.priority ?? 0,
        enabled: data.enabled ?? true,
        conditions: data.conditions,
        actions: data.actions,
        stopOnMatch: data.stopOnMatch ?? false,
      },
    });
  }

  async getInboxRules(projectId: string) {
    const inbox = await this.getInbox(projectId);
    if (!inbox) {
      throw new NotFoundException('Inbox not found for this project');
    }
    return this.prisma.inboxRule.findMany({
      where: { projectInboxId: inbox.id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  updateRule(ruleId: string, data: CreateRuleDto) {
    return this.prisma.inboxRule.update({
      where: { id: ruleId },
      data: {
        name: data.name,
        description: data.description,
        priority: data.priority,
        enabled: data.enabled,
        conditions: data.conditions,
        actions: data.actions,
        stopOnMatch: data.stopOnMatch,
      },
    });
  }

  deleteRule(ruleId: string) {
    return this.prisma.inboxRule.delete({
      where: { id: ruleId },
    });
  }

  // Helper methods
  private async getNextTaskNumber(projectId: string): Promise<any> {
    const lastTask = await this.prisma.task.findFirst({
      where: { projectId },
      orderBy: { taskNumber: 'desc' },
    });
    return (lastTask?.taskNumber || 0) + 1;
  }

  private async generateTaskSlug(title: string, projectId: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.task.findFirst({ where: { projectId, slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async copyAttachmentsToTask(messageId: string, taskId: string) {
    const messageAttachments = await this.prisma.messageAttachment.findMany({
      where: { messageId },
    });

    const taskAttachments = messageAttachments.map((attachment) => ({
      taskId,
      fileName: attachment.filename,
      filePath: attachment.storagePath,
      fileSize: attachment.size,
      mimeType: attachment.mimeType,
    }));

    if (taskAttachments.length > 0) {
      await this.prisma.taskAttachment.createMany({
        data: taskAttachments,
      });
    }
  }
}
