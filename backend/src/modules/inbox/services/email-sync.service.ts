import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/crypto.service';
import {
  EmailAccount,
  MessageAttachment,
  MessageStatus,
  SyncStatus,
  TaskPriority,
  User,
  UserSource,
} from '@prisma/client';
import { simpleParser, ParsedMail } from 'mailparser';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ImapFlow } from 'imapflow';
import { EmailSyncUtils } from '../utils/email-sync.utils';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { StorageService } from 'src/modules/storage/storage.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailReplyService } from './email-reply.service';

interface EmailMessage {
  messageId: string;
  imapUid: number;
  threadId: string;
  inReplyTo?: string;
  references?: string[];
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  text?: string;
  html?: string;
  date: Date;
  headers: any;
  attachments?: any[];
  htmlSignature?: string;
  textSignature?: string;
}

@Injectable()
export class EmailSyncService {
  private readonly logger = new Logger(EmailSyncService.name);

  // Wrapper function to properly type simpleParser call
  private async parseEmailMessage(source: Buffer): Promise<ParsedMail> {
    // Use unknown to safely handle mailparser's lacking type definitions
    const parser = simpleParser as unknown as (source: Buffer) => Promise<ParsedMail>;
    return await parser(source);
  }

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private storageService: StorageService,
    @Inject(forwardRef(() => EmailReplyService))
    private emailReplyService: EmailReplyService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllInboxes() {
    this.logger.log('Starting scheduled email sync for all inboxes');

    const now = new Date();

    const accounts = await this.prisma.emailAccount.findMany({
      where: {
        syncEnabled: true,
        projectInbox: {
          enabled: true,
          syncInterval: { not: null },
        },
      },
      include: {
        projectInbox: {
          include: {
            project: true,
          },
        },
      },
    });

    this.logger.log(`Found ${accounts.length} inboxes ready for sync check`);

    for (const account of accounts) {
      try {
        const syncIntervalMinutes = account.projectInbox.syncInterval || 5;

        // Check if enough time has passed since last sync
        const shouldSync =
          !account.lastSyncAt ||
          now.getTime() - account.lastSyncAt.getTime() >= syncIntervalMinutes * 60 * 1000;

        if (!shouldSync) {
          continue;
        }

        // Perform the sync
        await this.syncInbox(account);

        // Update email account sync status
        await this.prisma.emailAccount.update({
          where: { id: account.id },
          data: {
            lastSyncAt: now,
            lastSyncError: null,
          },
        });

        const nextSyncTime = new Date(now.getTime() + syncIntervalMinutes * 60 * 1000);
        this.logger.log(
          `Successfully synced inbox for ${account.emailAddress}. Next sync at: ${nextSyncTime.toISOString()}`,
        );
      } catch (error) {
        this.logger.error(`Failed to sync inbox for ${account.emailAddress}:`, error.message);

        await this.prisma.emailAccount.update({
          where: { id: account.id },
          data: {
            lastSyncAt: now,
            lastSyncError: error.message,
          },
        });
      }
    }

    this.logger.log('Completed scheduled email sync for all inboxes');
  }

  async syncInbox(account: EmailAccount & { projectInbox?: { projectId: string } | null }) {
    const log = await this.prisma.emailSyncLog.create({
      data: {
        projectId: account.projectInbox?.projectId || 'unknown',
        startedAt: new Date(),
        status: SyncStatus.FAILED,
      },
    });

    try {
      this.logger.log(`Starting sync for ${account.emailAddress}`);

      // Fetch messages (already sorted by date, oldest first)
      const messages = await this.fetchMessagesBasic(account);

      this.logger.log(`Processing ${messages.length} messages in chronological order`);

      // SINGLE PASS: Process messages sequentially in chronological order
      // This ensures parent emails are converted to tasks before replies arrive
      let processed = 0;
      for (const message of messages) {
        try {
          // Check if message already exists
          const existing = await this.prisma.inboxMessage.findUnique({
            where: { messageId: message.messageId },
          });

          if (existing) {
            this.logger.debug(`Message ${message.messageId} already exists, skipping`);
            continue;
          }

          // Create inbox message AND immediately process it for task/comment creation
          await this.createAndProcessMessage(message, account);
          processed++;
        } catch (error) {
          this.logger.error(`Failed to process message ${message.messageId}:`, error.message);
        }
      }

      this.logger.log(`Sync complete: Processed ${processed} new messages`);

      // Update sync log
      await this.prisma.emailSyncLog.update({
        where: { id: log.id },
        data: {
          completedAt: new Date(),
          status: SyncStatus.SUCCESS,
          messagesProcessed: processed,
        },
      });

      // Update account sync state
      await this.prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
      });

      this.logger.log(`Sync completed for ${account.emailAddress}.`);
    } catch (error) {
      console.error(`Error syncing email account ${account.emailAddress}:`, error);
      // ... error handling ...
    }
  }

  private async fetchMessagesBasic(account: EmailAccount): Promise<EmailMessage[]> {
    this.logger.log(`Fetching IMAP messages for ${account.emailAddress}`);

    let client: ImapFlow | null = null;

    try {
      if (!account.imapPassword) {
        throw new Error('IMAP password is required');
      }
      const password = this.crypto.decrypt(account.imapPassword);

      client = new ImapFlow({
        host: account.imapHost!,
        port: account.imapPort || 993,
        secure: account.imapUseSsl !== false,
        auth: {
          user: account.imapUsername!,
          pass: password,
        },
        logger: false,

        /** ✅ SNI hostname for TLS validation (required for IP-based connections) */
        ...(account.imapServername && { servername: account.imapServername }),

        /** ✅ TLS/SSL Configuration */
        tls: {
          rejectUnauthorized: account.imapTlsRejectUnauth !== false,
          minVersion: (account.imapTlsMinVersion as any) || 'TLSv1.2',
          ...(account.imapServername && { servername: account.imapServername }),
        },

        /** ✅ Timeout safety */
        socketTimeout: 120000,
        greetingTimeout: 60000,
        connectionTimeout: 60000,
        disableAutoIdle: true,
      });

      /** ✅ Catch unhandled internal errors (prevents Node crash) */
      client.on('error', (err) => {
        this.logger.error(`IMAP client error for ${account.emailAddress}: ${err.message}`);
      });

      /** ✅ Connect safely with timeout */
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('IMAP connect timeout')), 60000),
        ),
      ]);

      this.logger.log(`Connected to IMAP server for ${account.emailAddress}`);

      // Lock mailbox
      const mailbox = await client.getMailboxLock(account.imapFolder || 'INBOX');

      try {
        const searchCriteria = account.lastSyncAt ? { since: account.lastSyncAt } : { all: true };

        const messagesIterable = client.fetch(
          searchCriteria,
          { envelope: true, bodyStructure: true, source: true, uid: true },
          { uid: true },
        );

        const emailMessages: EmailMessage[] = [];

        for await (const message of messagesIterable) {
          try {
            const parsed: ParsedMail = await this.parseEmailMessage(message.source as Buffer);

            // Build base message object with normalized data
            // Note: references parsing is handled by EmailSyncUtils.extractThreadId
            const baseMessage = {
              messageId:
                parsed.messageId ||
                `generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              imapUid: message.uid,
              inReplyTo: parsed.inReplyTo || undefined,
              references: parsed.references, // Keep raw format - extractThreadId will normalize it
              subject: parsed.subject || 'No Subject',
              from: EmailSyncUtils.formatAddress(
                parsed.from?.text || parsed.from?.value?.[0]?.address,
              ),
              to: parsed.to ? EmailSyncUtils.formatAddressList(parsed.to) : [],
              cc: parsed.cc ? EmailSyncUtils.formatAddressList(parsed.cc) : [],
              bcc: parsed.bcc ? EmailSyncUtils.formatAddressList(parsed.bcc) : [],
              text: parsed.text || '',
              html: parsed.html || '',
              date: parsed.date || new Date(),
              headers: parsed.headers || {},
              attachments: parsed.attachments || [],
            };

            // Clean text/html to remove signatures and quoted content
            const cleanText = EmailSyncUtils.extractVisibleReply(
              String(baseMessage.text || ''),
              false,
            );
            const cleanHtml = EmailSyncUtils.extractVisibleReply(
              String(baseMessage.html || ''),
              true,
            );

            // Extract signatures separately
            const { signature: textSignature } = EmailSyncUtils.extractSignature(cleanText);
            const { signature: htmlSignature } = EmailSyncUtils.extractSignatureHtml(cleanHtml);

            // Extract thread ID using improved utility method (handles all reference formats)
            const threadId = EmailSyncUtils.extractThreadId(baseMessage);

            const emailMessage: EmailMessage = {
              ...baseMessage,
              text: cleanText,
              html: cleanHtml,
              threadId,
              htmlSignature,
              textSignature,
            };

            emailMessages.push(emailMessage);
          } catch (parseError) {
            const errorMessage =
              parseError instanceof Error ? parseError.message : String(parseError);
            this.logger.error(`Failed to parse message: ${errorMessage}`);
          }
        }

        this.logger.log(`Fetched ${emailMessages.length} messages from ${account.emailAddress}`);

        // Sort messages by date (oldest first) to ensure original emails are processed before replies
        emailMessages.sort((a, b) => a.date.getTime() - b.date.getTime());

        return emailMessages;
      } finally {
        mailbox.release();
        this.logger.log('Mailbox lock released');
      }
    } catch (error: any) {
      console.error(error);
      // Log the specific error type for better debugging
      if (error.code === 'ETIMEOUT') {
        this.logger.error(
          `❌ IMAP timeout for ${account.emailAddress} - Connection timed out after 60s`,
        );
      } else if (error.authenticationFailed) {
        this.logger.error(
          `❌ IMAP authentication failed for ${account.emailAddress} - Check credentials`,
        );
      } else {
        this.logger.error(
          `❌ IMAP connection failed for ${account.emailAddress}: ${error.message}`,
          error.stack,
        );
      }

      // Re-throw the error so sync is marked as failed (not silently ignored)
      // This allows the sync log to properly record the failure
      throw new Error(`IMAP fetch failed for ${account.emailAddress}: ${error.message}`);
    } finally {
      if (client) {
        try {
          await Promise.race([
            client.logout(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('IMAP logout timeout')), 5000),
            ),
          ]);
          this.logger.log('IMAP client logged out');
        } catch (logoutError: any) {
          this.logger.warn(`Failed to logout IMAP client: ${logoutError.message}`);
        }
      }
    }
  }

  // Combined: Create InboxMessage AND immediately process for task/comment
  private async createAndProcessMessage(message: EmailMessage, account: EmailAccount) {
    this.logger.log(`Processing message: ${message.subject} (${message.date.toISOString()})`);

    // Extract thread ID
    const existingMessage = await this.prisma.inboxMessage.findUnique({
      where: { messageId: message.messageId },
    });

    if (existingMessage) {
      this.logger.debug(`Message ${message.messageId} already exists, skipping`);
      return; // Skip processing
    }
    const threadId = EmailSyncUtils.extractThreadId(message);

    // Normalize references
    let normalizedReferences: string[] = [];
    const messageRefs = message.references as any;
    if (messageRefs) {
      if (Array.isArray(messageRefs)) {
        normalizedReferences = messageRefs
          .filter(
            (ref): ref is string => ref !== null && ref !== undefined && typeof ref === 'string',
          )
          .map((ref) => ref.trim())
          .filter((ref) => ref.length > 0);
      } else if (typeof messageRefs === 'string') {
        const refString = messageRefs.trim();
        if (refString) {
          normalizedReferences = refString
            .split(/\s+/)
            .map((ref) => ref.trim())
            .filter((ref) => ref.length > 0);
        }
      }
    }

    // Get project inbox
    const projectInbox = await this.prisma.projectInbox.findUnique({
      where: { id: account.projectInboxId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    if (!projectInbox) {
      throw new NotFoundException('Project inbox not found');
    }

    // Create or get user
    const emailUser = await this.findOrCreateUserFromEmail(
      message.from,
      projectInbox.project.workspace.organization.id,
      projectInbox.project.workspace.id,
      projectInbox.project.id,
    );

    // Create inbox message
    const inboxMessage = await this.prisma.inboxMessage.create({
      data: {
        projectInboxId: account.projectInboxId,
        messageId: message.messageId,
        imapUid: message.imapUid,
        threadId,
        inReplyTo: message.inReplyTo || null,
        references: normalizedReferences,
        subject: message.subject,
        fromEmail: EmailSyncUtils.extractEmail(message.from),
        fromName: EmailSyncUtils.extractName(message.from),
        toEmails: message.to.map((addr) => EmailSyncUtils.extractEmail(addr)),
        ccEmails: message.cc.map((addr) => EmailSyncUtils.extractEmail(addr)),
        bccEmails: message.bcc.map((addr) => EmailSyncUtils.extractEmail(addr)),
        bodyText: message.text,
        bodyHtml: message.html,
        snippet: EmailSyncUtils.createSnippet(message.text || message.html || ''),
        headers: message.headers || {},
        hasAttachments: (message.attachments?.length ?? 0) > 0,
        emailDate: message.date,
        status: MessageStatus.PENDING,
        htmlSignature: message.htmlSignature,
        textSignature: message.textSignature,
      },
    });

    // Process attachments
    if (message.attachments?.length) {
      await this.processAttachments(message.attachments, inboxMessage.id);
    }

    // ✅ FIX: Reload with attachments and add null check
    const inboxMessageWithAttachments = await this.prisma.inboxMessage.findUnique({
      where: { id: inboxMessage.id },
      include: { attachments: true },
    });

    if (!inboxMessageWithAttachments) {
      this.logger.error(`Failed to reload inbox message ${inboxMessage.id}`);
      throw new Error('Inbox message not found after creation');
    }

    // Apply rules
    const ruleResult = await this.applyRules(inboxMessageWithAttachments);

    // ✅ IMMEDIATE PROCESSING: Auto-create task/comment right away
    if (
      projectInbox.autoCreateTask &&
      inboxMessageWithAttachments.status === MessageStatus.PENDING
    ) {
      await this.autoCreateTask(inboxMessageWithAttachments, projectInbox, emailUser.id);
    }

    // ✅ Send global auto-reply if enabled (only if no rule-based auto-reply was sent)
    if (
      projectInbox.autoReplyEnabled &&
      projectInbox.autoReplyTemplate &&
      !ruleResult.autoReplySent
    ) {
      try {
        await this.emailReplyService.sendAutoReply(inboxMessage.id);
        this.logger.log(`Global auto-reply sent for message ${message.messageId}`);
      } catch (error) {
        this.logger.error(
          `Failed to send global auto-reply for message ${message.messageId}:`,
          error.message,
        );
        // Don't throw - message processing succeeded, auto-reply is non-critical
      }
    } else if (ruleResult.autoReplySent) {
      this.logger.log(
        `Skipping global auto-reply for message ${message.messageId} - rule-based auto-reply already sent`,
      );
    }

    // ⭐ Mark as read on IMAP server after successful processing
    try {
      await this.markMessageAsReadOnServer(inboxMessage.id);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      this.logger.error(`Failed to mark as read, but message was processed successfully`);
      // Don't throw - message processing succeeded, mark as read is non-critical
    }

    this.logger.log(`✅ Completed processing message ${message.messageId}`);
  }

  // Helper method to find or create user from email and add to all levels
  private async findOrCreateUserFromEmail(
    fromField: string,
    organizationId: string,
    workspaceId: string,
    projectId: string,
  ): Promise<User> {
    const email = EmailSyncUtils.extractEmail(fromField);
    const name = EmailSyncUtils.extractName(fromField);

    // Check if user already exists by email only
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // If user doesn't exist, create new user
    if (!user) {
      const [firstName, ...lastNameParts] = (name || email.split('@')[0]).split(' ');
      const lastName = lastNameParts.join(' ') || '';

      // Generate a secure random password (64 characters, cryptographically secure)
      // External users will need to use "forgot password" to set their own password
      const secureRandomPassword = randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(secureRandomPassword, 10);

      // Generate unique username
      const baseUsername = email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const uniqueUsername = await this.generateUniqueUsername(baseUsername);

      user = await this.prisma.user.create({
        data: {
          email,
          firstName: firstName || email.split('@')[0],
          lastName: lastName || '',
          username: uniqueUsername,
          emailVerified: false,
          status: 'ACTIVE',
          role: 'VIEWER',
          password: hashedPassword,
          source: UserSource.EMAIL_INBOX, // Mark as email-created user
        },
      });

      this.logger.log(
        `Created new user from email: ${email} with username: ${uniqueUsername} (source: EMAIL_INBOX, secure random password generated)`,
      );
    } else {
      this.logger.log(`User ${email} already exists, skipping creation`);
    }

    // Add user to organization, workspace, and project with VIEWER role
    await this.prisma.$transaction(async (tx) => {
      // Add to organization if not already a member
      const existingOrgMember = await tx.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organizationId,
          },
        },
      });

      if (!existingOrgMember) {
        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: organizationId,
            role: 'VIEWER',
          },
        });
        this.logger.log(`Added user ${email} to organization as VIEWER`);
      }

      // Add to workspace if not already a member
      const existingWorkspaceMember = await tx.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: workspaceId,
          },
        },
      });

      if (!existingWorkspaceMember) {
        await tx.workspaceMember.create({
          data: {
            userId: user.id,
            workspaceId: workspaceId,
            role: 'VIEWER',
          },
        });
        this.logger.log(`Added user ${email} to workspace as VIEWER`);
      }

      // Add to project if not already a member
      const existingProjectMember = await tx.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId: projectId,
          },
        },
      });

      if (!existingProjectMember) {
        await tx.projectMember.create({
          data: {
            userId: user.id,
            projectId: projectId,
            role: 'VIEWER',
          },
        });
        this.logger.log(`Added user ${email} to project as VIEWER`);
      }
    });

    return user;
  }

  // Helper method to generate unique username
  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername;
    let counter = 1;

    // Keep checking until we find a unique username
    while (true) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!existingUser) {
        // Username is available
        return username;
      }

      // Try next variation
      username = `${baseUsername}${counter}`;
      counter++;
    }
  }

  private async processAttachments(attachments: any[], messageId: string) {
    const attachmentData: any[] = [];

    for (const attachment of attachments) {
      try {
        // Upload to S3
        const contentBuffer = Buffer.from(String(attachment.content), 'base64');
        const file: Express.Multer.File = {
          originalname: String(attachment.filename || 'attachment'),
          mimetype: String(attachment.contentType || 'application/octet-stream'),
          buffer: contentBuffer,
          size: (attachment.size as number) || contentBuffer.length,
          fieldname: 'attachment',
          encoding: '7bit',
          stream: Readable.from(contentBuffer), // Create readable stream from buffer
          destination: '',
          filename: String(attachment.filename || 'attachment'),
          path: '',
        };
        const { url, key, size } = await this.storageService.saveFile(
          file,
          `inbox/messages/${messageId}`,
        );
        attachmentData.push({
          messageId,
          filename: attachment.filename || 'unnamed',
          mimeType: attachment.contentType || 'application/octet-stream',
          size: size,
          contentId: attachment.cid,
          storagePath: key,
          storageUrl: url,
        });
      } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to upload attachment ${String(attachment.filename)}:`,
          errorMessage,
        );
        // Continue with other attachments, but log the failure
      }
    }

    if (attachmentData.length > 0) {
      await this.prisma.messageAttachment.createMany({
        data: attachmentData,
      });
    }
  }

  private async applyRules(message: any): Promise<{ autoReplySent: boolean }> {
    // Get rules for this inbox, ordered by priority
    const rules = await this.prisma.inboxRule.findMany({
      where: {
        projectInboxId: message.projectInboxId,
        enabled: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    let autoReplySent = false;

    for (const rule of rules) {
      try {
        const matches = this.evaluateRuleConditions(rule.conditions, message);

        if (matches) {
          this.logger.log(`Rule "${rule.name}" matched for message ${message.messageId}`);
          if (rule.actions && typeof rule.actions === 'object' && !Array.isArray(rule.actions)) {
            const result = await this.executeRuleActions(
              rule.actions as Record<string, unknown>,
              message,
              rule.id,
            );
            if (result.autoReplySent) {
              autoReplySent = true;
            }
          }

          if (rule.stopOnMatch) {
            this.logger.log(`Stopping rule processing due to stopOnMatch`);
            break;
          }
        }
      } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error applying rule ${rule.name}:`, errorMessage);
      }
    }

    return { autoReplySent };
  }

  private evaluateRuleConditions(conditions: any, message: any): boolean {
    // Simple rule evaluation logic
    // In production, you'd want a more sophisticated rule engine

    if (conditions.any) {
      return (conditions.any as any[]).some((condition) =>
        this.evaluateCondition(condition, message),
      );
    }

    if (conditions.all) {
      return (conditions.all as any[]).every((condition) =>
        this.evaluateCondition(condition, message),
      );
    }

    return this.evaluateCondition(conditions, message);
  }

  private evaluateCondition(condition: any, message: any): boolean {
    for (const [field, rules] of Object.entries(condition as Record<string, unknown>)) {
      const fieldValue = this.getFieldValue(field, message);

      if (typeof rules === 'object' && rules !== null) {
        for (const [operator, value] of Object.entries(rules as Record<string, unknown>)) {
          switch (operator) {
            case 'contains': {
              const lower = (fieldValue as string)?.toLowerCase();
              return lower?.includes((value as string).toLowerCase()) || false;
            }
            case 'equals':
              return fieldValue === value;
            case 'matches': {
              try {
                const pattern = value as string;
                // Validate regex pattern by attempting to compile it
                const regex = new RegExp(pattern, 'i');
                return regex.test(fieldValue as string);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const patternString = String(value);
                this.logger.error(
                  `Invalid regex pattern: "${patternString}". Error: ${errorMessage}`,
                );
                return false;
              }
            }
            case 'startsWith': {
              const lower = (fieldValue as string)?.toLowerCase();
              return lower?.startsWith((value as string).toLowerCase()) || false;
            }
            case 'endsWith': {
              const lower = (fieldValue as string)?.toLowerCase();
              return lower?.endsWith((value as string).toLowerCase()) || false;
            }
          }
        }
      }
    }

    return false;
  }

  private getFieldValue(field: string, message: any): any {
    switch (field) {
      case 'from':
        return message.fromEmail;
      case 'subject':
        return message.subject;
      case 'body':
        return message.bodyText || message.bodyHtml;
      case 'to':
        return (message.toEmails as string[]).join(',');
      case 'cc':
        return (message.ccEmails as string[]).join(',');
      default:
        return '';
    }
  }

  private async executeRuleActions(
    actions: Record<string, unknown>,
    message: any,
    ruleId: string,
  ): Promise<{ autoReplySent: boolean }> {
    // Collect rule outcomes to persist to database
    const ruleResult: {
      priority?: TaskPriority;
      assigneeId?: string;
      labelIds: string[];
      taskType?: string;
    } = {
      labelIds: [],
    };

    let autoReplySent = false;

    // Execute rule actions
    const actionEntries = Object.entries(actions);
    for (const [action, value] of actionEntries) {
      try {
        switch (action) {
          case 'setPriority':
            // Store priority to persist to database
            ruleResult.priority = value as TaskPriority;
            break;
          case 'assignTo':
            // Store assignee to persist to database
            ruleResult.assigneeId = value as string;
            break;
          case 'addLabels':
            // Store labels to persist to database
            ruleResult.labelIds = Array.isArray(value) ? (value as string[]) : [value as string];
            break;
          case 'setTaskType':
            // Store task type to persist to database
            ruleResult.taskType = value as string;
            break;
          case 'markAsSpam':
            await this.prisma.inboxMessage.update({
              where: { id: message.id },
              data: { isSpam: true, status: MessageStatus.IGNORED },
            });
            break;
          case 'autoReply':
            await this.sendAutoReplyFromRule(message, value as string);
            autoReplySent = true;
            break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error executing action ${action}: ${errorMessage}`);
      }
    }

    // Persist rule result to database
    await this.prisma.messageRuleResult.create({
      data: {
        messageId: message.id,
        ruleId: ruleId,
        priority: ruleResult.priority,
        assigneeId: ruleResult.assigneeId,
        labelIds: ruleResult.labelIds,
        taskType: ruleResult.taskType,
        matched: true,
        stopped: false, // This will be updated if stopOnMatch is true
      },
    });

    this.logger.log(
      `Rule result persisted for message ${message.messageId}: priority=${ruleResult.priority}, assignee=${ruleResult.assigneeId}, labels=${ruleResult.labelIds.join(',')}`,
    );

    return { autoReplySent };
  }

  private async autoCreateTask(message: any, inbox: any, repoterId: string) {
    try {
      const inboxMessage = await this.prisma.inboxMessage.findUnique({
        where: { id: message.id },
        include: { attachments: true },
      });
      if (!inboxMessage) {
        this.logger.error(`Inbox message not found`);
        return;
      }
      if (inboxMessage?.status === MessageStatus.IGNORED) {
        this.logger.log(`Skipping message ${message.messageId} as its status is IGNORE`);
        return;
      }

      // Try to find existing task using thread ID (should work reliably with improved extraction)
      // Search within the same project to ensure security
      let existingTask = await this.prisma.task.findFirst({
        where: {
          emailThreadId: message.threadId,
          projectId: inbox.projectId,
        },
        include: {
          project: {
            include: {
              members: true, // Get all members for permission checks
            },
          },
        },
      });

      // Fallback 1: Check if replying to a task comment that was sent as email
      // This handles the case where someone replies to a comment notification email
      if (!existingTask && message.inReplyTo) {
        this.logger.debug(`Primary thread match failed, checking if reply is to a task comment`);
        const existingComment = await this.prisma.taskComment.findFirst({
          where: {
            emailMessageId: message.inReplyTo,
          },
          include: {
            task: {
              include: {
                project: {
                  include: {
                    members: true,
                  },
                },
              },
            },
          },
        });

        if (existingComment?.task && existingComment.task.projectId === inbox.projectId) {
          existingTask = existingComment.task;
          if (existingTask) {
            this.logger.log(`✅ Found parent task via comment match: ${existingTask.id}`);
          }
        }
      }

      // Fallback 2: Check if replying to an inbox message that hasn't been converted yet
      // This can happen if emails arrive out of order
      if (!existingTask && message.inReplyTo) {
        this.logger.debug(`Checking if reply is to an unconverted inbox message`);
        const existingInboxMessage = await this.prisma.inboxMessage.findFirst({
          where: {
            messageId: message.inReplyTo,
            projectInboxId: inbox.id,
            converted: true, // Only check converted messages
          },
          include: {
            task: {
              include: {
                project: {
                  include: {
                    members: true,
                  },
                },
              },
            },
          },
        });

        if (existingInboxMessage?.task) {
          existingTask = existingInboxMessage.task;
          if (existingTask) {
            this.logger.log(`✅ Found parent task via inbox message match: ${existingTask.id}`);
          }
        }
      }

      if (existingTask) {
        // Add as comment to existing task
        this.logger.log(
          `✅ Reply matched! Adding as comment to task ${existingTask.id} (threadId: ${message.threadId})`,
        );
        const defaultAuthorId =
          repoterId || inbox.defaultAuthorId || existingTask.project.members[0]?.userId;
        await this.prisma.taskComment.create({
          data: {
            taskId: existingTask.id,
            authorId: defaultAuthorId,
            content: message.bodyHtml || message.bodyText || message.subject,
            emailMessageId: message.messageId,
            emailRecipientNames: message.fromName,
            createdBy: defaultAuthorId,
            updatedBy: defaultAuthorId,
          },
        });
        if (inboxMessage.attachments && inboxMessage.attachments.length > 0) {
          await this.copyAttachmentsToTask(
            inboxMessage.attachments,
            existingTask.id,
            String(defaultAuthorId),
          );
        }
        // Update message
        await this.prisma.inboxMessage.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.CONVERTED,
            converted: true,
            convertedAt: new Date(),
          },
        });

        this.logger.log(`Added message as comment to existing task ${existingTask.id}`);
        return;
      }

      // No parent task found - this will create a new task
      // Log detailed information to help debug threading issues
      const isReply = message.inReplyTo || (message.references && message.references.length > 0);
      if (isReply) {
        this.logger.warn(
          `⚠️ Creating NEW task for what appears to be a REPLY - Thread matching failed`,
        );
        this.logger.warn(`   Message ID: ${message.messageId}`);
        this.logger.warn(`   Thread ID: ${message.threadId}`);
        this.logger.warn(`   In-Reply-To: ${message.inReplyTo || 'none'}`);
        this.logger.warn(
          `   References: ${message.references?.length ? (message.references as string[]).join(', ') : 'none'}`,
        );
        this.logger.warn(`   Subject: ${message.subject}`);
        this.logger.warn(`   From: ${message.fromEmail}`);

        // Check if there are ANY tasks with similar thread IDs for debugging
        const similarTasks = await this.prisma.task.findMany({
          where: {
            projectId: inbox.projectId,
            emailThreadId: { not: null },
          },
          select: {
            id: true,
            taskNumber: true,
            emailThreadId: true,
            title: true,
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
        });

        if (similarTasks.length > 0) {
          this.logger.warn(`   Recent tasks with email threads in this project:`);
          similarTasks.forEach((task) => {
            this.logger.warn(
              `     - Task #${task.taskNumber}: threadId="${task.emailThreadId}", title="${task.title}"`,
            );
          });
        } else {
          this.logger.warn(`   No existing tasks with email threads found in this project`);
        }
      } else {
        this.logger.log(
          `📧 Creating new task from original email (not a reply): ${message.subject}`,
        );
      }
      const taskNumber = await EmailSyncUtils.getNextTaskNumber(
        String(inbox.projectId),
        this.prisma,
      );
      const slug = await EmailSyncUtils.generateTaskSlug(
        String(message.subject),
        String(inbox.projectId),
        this.prisma,
      );
      const sprintResult = await this.prisma.sprint.findFirst({
        where: { projectId: inbox.projectId, isDefault: true },
      });
      const sprintId = sprintResult?.id || null;
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(now.getDate() + 7);

      // Load rule results from database
      const ruleResults = await this.prisma.messageRuleResult.findMany({
        where: { messageId: message.id },
        orderBy: { createdAt: 'asc' }, // First matching rule takes precedence
      });

      // Aggregate rule results
      const rulePriority = ruleResults[0]?.priority || inbox.defaultPriority;
      const ruleAssignee = ruleResults[0]?.assigneeId || inbox.defaultAssigneeId;
      const ruleTaskType = ruleResults[0]?.taskType || inbox.defaultTaskType;
      const ruleLabels = ruleResults
        .flatMap((r) => r.labelIds)
        .filter((id): id is string => Boolean(id)); // Combine all labels from all rules

      this.logger.log(
        `Creating task with rule data: priority=${String(rulePriority)}, assignee=${String(ruleAssignee)}, taskType=${String(ruleTaskType)}, labels=[${ruleLabels.join(', ')}]`,
      );

      const taskData: any = {
        projectId: inbox.projectId,
        title: message.subject,
        sprintId,
        description: message.bodyHtml || message.bodyText,
        type: ruleTaskType,
        priority: rulePriority,
        statusId: inbox.defaultStatusId,
        emailThreadId: message.threadId,
        allowEmailReplies: true,
        inboxMessageId: message.id,
        taskNumber,
        slug,
        startDate: now,
        dueDate,
        reporters: {
          connect: [{ id: repoterId || inbox.defaultAuthorId }],
        },
      };
      if (ruleAssignee) {
        taskData.assignees = {
          connect: { id: ruleAssignee },
        };
      }

      // Add all labels from all matching rules
      if (ruleLabels.length > 0) {
        taskData.labels = {
          connect: ruleLabels.map((labelId) => ({ id: labelId })),
        };
      }

      const task = await this.prisma.task.create({
        data: {
          ...taskData,
          createdBy: repoterId || inbox.defaultAuthorId,
          updatedBy: repoterId || inbox.defaultAuthorId,
        },
      });
      if (inboxMessage.attachments && inboxMessage.attachments.length > 0) {
        await this.copyAttachmentsToTask(
          inboxMessage.attachments,
          task.id,
          String(repoterId || inbox.defaultAuthorId),
        );
      }
      // Update message
      await this.prisma.inboxMessage.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.CONVERTED,
          converted: true,
          convertedAt: new Date(),
        },
      });

      this.logger.log(`Auto-created task ${task.id} from message ${message.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to auto-create task:`, error.message);
    }
  }

  private async copyAttachmentsToTask(
    inboxAttachments: MessageAttachment[],
    taskId: string,
    userId: string,
  ) {
    try {
      for (const inboxAttachment of inboxAttachments) {
        // Create task attachment record pointing to the same storage location
        await this.prisma.taskAttachment.create({
          data: {
            taskId: taskId,
            fileName: inboxAttachment.filename,
            fileSize: inboxAttachment.size,
            mimeType: inboxAttachment.mimeType,
            url: inboxAttachment.storageUrl, // Same URL (null for S3, path for local)
            storageKey: inboxAttachment.storagePath, // Same storage key
            createdBy: userId,
          },
        });

        this.logger.log(`Copied attachment ${inboxAttachment.filename} to task ${taskId}`);
      }
    } catch (error) {
      this.logger.error('Failed to copy attachments to task:', error);
      // Don't throw - task creation should succeed even if attachment copy fails
    }
  }

  private async sendAutoReplyFromRule(message: any, template: string) {
    try {
      // Get project inbox with email account
      const inbox = await this.prisma.projectInbox.findUnique({
        where: { id: message.projectInboxId },
        include: { emailAccount: true },
      });

      if (!inbox?.emailAccount) {
        this.logger.warn(`No email account configured for auto-reply`);
        return;
      }

      // Create SMTP transporter
      if (!inbox.emailAccount.smtpPassword) {
        throw new Error('SMTP password is required');
      }
      const password = this.crypto.decrypt(inbox.emailAccount.smtpPassword);

      type SecureVersion = 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';

      const transportOptions: SMTPTransport.Options = {
        host: inbox.emailAccount.smtpHost!,
        port: inbox.emailAccount.smtpPort!,
        secure: inbox.emailAccount.smtpPort === 465,
        requireTLS: inbox.emailAccount.smtpRequireTls === true, // Force STARTTLS upgrade
        auth: {
          user: inbox.emailAccount.smtpUsername!,
          pass: password,
        },
        tls: {
          rejectUnauthorized: inbox.emailAccount.smtpTlsRejectUnauth !== false,
          minVersion: (inbox.emailAccount.smtpTlsMinVersion || 'TLSv1.2') as SecureVersion,
          ...(inbox.emailAccount.smtpServername && {
            servername: inbox.emailAccount.smtpServername,
          }),
        },
      };

      const transporter: Transporter<SMTPTransport.SentMessageInfo> =
        nodemailer.createTransport(transportOptions);

      // Generate reply email
      const mailOptions = {
        from: `${inbox.name} <${inbox.emailAccount.emailAddress}>`,
        to: message.fromEmail,
        subject: `Re: ${message.subject}`,
        text: template,
        html: template.replace(/\n/g, '<br>'),
        inReplyTo: message.messageId,
        messageId: `<${Date.now()}.${Math.random().toString(36)}@${process.env.EMAIL_DOMAIN || 'taskosaur.com'}>`,
      };

      await transporter.sendMail(mailOptions);
      this.logger.log(`Auto-reply sent to ${message.fromEmail} for message ${message.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send auto-reply:`, error.message);
    }
  }

  // Method to manually trigger sync for a specific inbox
  async triggerSync(projectId: string) {
    const account = await this.prisma.emailAccount.findFirst({
      where: { projectInbox: { projectId } },
      include: { projectInbox: true },
    });

    if (!account) {
      throw new Error('No email account found for this project');
    }

    return this.syncInbox(account);
  }

  // Mark email as read on IMAP server using UID
  async markMessageAsReadOnServer(inboxMessageId: string): Promise<void> {
    this.logger.log(`Marking message ${inboxMessageId} as read on IMAP server`);

    const message = await this.prisma.inboxMessage.findUnique({
      where: { id: inboxMessageId },
      include: {
        projectInbox: {
          include: { emailAccount: true },
        },
      },
    });

    if (!message?.imapUid || !message.projectInbox?.emailAccount) {
      this.logger.warn(`Cannot mark as read: missing UID or account for message ${inboxMessageId}`);
      return;
    }

    const account = message.projectInbox.emailAccount;
    let client: ImapFlow | null = null;

    try {
      if (!account.imapPassword) throw new Error('IMAP password is required');

      const password = this.crypto.decrypt(account.imapPassword);

      client = new ImapFlow({
        host: account.imapHost!,
        port: account.imapPort || 993,
        secure: account.imapUseSsl !== false,
        auth: {
          user: account.imapUsername!,
          pass: password,
        },
        logger: false,
        socketTimeout: 15000, // Reduced from 30s to 15s
        greetingTimeout: 15000,
        connectionTimeout: 15000,
        disableAutoIdle: true,
      });
      const errorHandler = (err: Error) => {
        this.logger.error(`IMAP client error during mark as read: ${err.message}`);
      };
      client.on('error', errorHandler);
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('IMAP connect timeout')), 15000),
        ),
      ]);

      const mailbox = await client.getMailboxLock(account.imapFolder || 'INBOX');

      try {
        await client.messageFlagsAdd(String(message.imapUid), ['\\Seen'], { uid: true });
        this.logger.log(`Marked message as read on server (UID: ${message.imapUid})`);
      } finally {
        mailbox.release();
      }
    } catch (error: any) {
      if (error.code === 'ETIMEOUT') {
        this.logger.warn(`IMAP timeout while marking message as read: ${error.message}`);
      } else {
        this.logger.error(`Failed to mark message as read on IMAP server: ${error.message}`);
      }
    } finally {
      if (client) {
        try {
          await Promise.race([
            client.logout(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('IMAP logout timeout')), 3000),
            ),
          ]);
        } catch (logoutError: any) {
          this.logger.warn(`Failed to logout IMAP client: ${logoutError.message}`);
        }
      }
    }
  }
}
