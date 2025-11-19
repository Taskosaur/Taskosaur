import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/crypto.service';
import { EmailAccount } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { decode } from 'html-entities';
import { ImapFlow, ImapFlowOptions } from 'imapflow';
export class TestEmailConfigDto {
  emailAddress: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  imapUseSsl: boolean;
  imapServername?: string;
  imapFolder: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpServername?: string;
  smtpRequireTls?: boolean;
}
@Injectable()
export class EmailReplyService {
  private readonly logger = new Logger(EmailReplyService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  private decodeHtml(html: string): string {
    return decode(html);
  }

  async sendCommentAsEmail(commentId: string) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          include: {
            inboxMessage: {
              include: {
                projectInbox: {
                  include: { emailAccount: true },
                },
              },
            },
            project: true,
            createdByUser: true,
          },
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (!comment.task.allowEmailReplies) {
      throw new Error('Email replies are not enabled for this task');
    }

    const inboxMessage = comment.task.inboxMessage;
    if (!inboxMessage) {
      return this.sendNewThreadEmailAndCreateInboxMessage(comment.id, comment.task.id);
    }

    if (comment.sentAsEmail) {
      throw new Error('Comment has already been sent as email');
    }

    const account = inboxMessage.projectInbox.emailAccount;
    if (!account) {
      throw new Error('No email account configured for this inbox');
    }

    try {
      this.logger.log(`Sending comment ${commentId} as email reply`);

      const transporter = this.getTransporter(account);
      const emailMessageId = this.generateMessageId();
      const hasEscapedHtml = /&lt;|&gt;|&amp;|&quot;|&#39;/.test(comment.content);

      const htmlContent = hasEscapedHtml ? this.decodeHtml(comment.content) : comment.content;

      const mailOptions = {
        from: this.formatSenderAddress(comment.author, account),
        to: inboxMessage.fromEmail,
        cc: inboxMessage.ccEmails?.length ? inboxMessage.ccEmails.join(',') : undefined,
        subject: `Re: ${inboxMessage.subject}`,
        html: htmlContent,
        inReplyTo: inboxMessage.messageId,
        references: this.buildReferencesHeader(inboxMessage),
        messageId: emailMessageId,
      };

      if (inboxMessage.projectInbox.emailSignature) {
        const hasEscapedHtml = /&lt;|&gt;|&amp;|&quot;|&#39;/.test(
          inboxMessage.projectInbox.emailSignature,
        );
        const htmlSignature = hasEscapedHtml
          ? this.decodeHtml(inboxMessage.projectInbox.emailSignature)
          : inboxMessage.projectInbox.emailSignature;
        mailOptions.html += `<br><br>${htmlSignature.replace(/\n/g, '<br>')}`;
      } else {
        const defaultSignature = `
        <br><br>
        <div style="font-family:Arial, sans-serif; color:#555;">
          <p>Best regards,</p>
          <p><strong>The ${comment.task.project.name} Team</strong></p>
          <p style="font-size:12px; color:#888;">This message was sent automatically by our task management system.</p>
        </div>
      `;
        mailOptions.html += defaultSignature;
      }

      const info = await transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully: ${info.messageId}`);

      await this.prisma.taskComment.update({
        where: { id: commentId },
        data: {
          emailMessageId,
          sentAsEmail: true,
          emailRecipients: [inboxMessage.fromEmail, ...inboxMessage.ccEmails],
          emailSentAt: new Date(),
        },
      });

      return {
        success: true,
        messageId: info.messageId,
        recipients: [inboxMessage.fromEmail, ...inboxMessage.ccEmails],
      };
    } catch (error) {
      this.logger.error(`Failed to send email for comment ${commentId}:`, error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
  private async sendNewThreadEmailAndCreateInboxMessage(commentId: string, taskId: string) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      include: {
        task: true,
        author: true,
      },
    });
    if (!comment) {
      throw new Error('Comment not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            name: true,
            inbox: {
              select: {
                id: true,
                emailAccount: true,
                autoReplyEnabled: true,
                autoReplyTemplate: true,
              },
            },
          },
        },
        createdByUser: true,
        reporters: {
          select: { email: true },
        },
      },
    });

    if (!task) {
      throw new Error('Task is not found');
    }

    const account = task.project.inbox?.emailAccount;
    if (!account) {
      throw new Error('No email account configured for this project inbox');
    }

    const transporter = this.getTransporter(account);
    const emailMessageId = this.generateMessageId();

    const hasEscapedHtml: boolean = /&lt;|&gt;|&amp;|&quot;|&#39;/.test(comment.content);
    const htmlContent: string = String(
      hasEscapedHtml ? this.decodeHtml(comment.content) : comment.content,
    );

    const mailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      messageId: string;
    } = {
      from: this.formatSenderAddress(comment.author, account),
      to: task.createdByUser?.email || comment.author.email,
      subject: `New Task Comment on ${task.project.name}`,
      html: htmlContent,
      messageId: emailMessageId,
    };

    // Append signature logic here or reuse existing

    const info = await transporter.sendMail(mailOptions);
    if (!task.project.inbox) {
      throw new Error('No email account configured for this project inbox');
    }
    const newInboxMessage = await this.prisma.inboxMessage.create({
      data: {
        projectInboxId: task.project.inbox.id,
        messageId: emailMessageId,
        threadId: emailMessageId, // Using messageId as threadId, adjust if needed
        inReplyTo: null,
        references: [], // Empty for new thread
        subject: mailOptions.subject,
        fromEmail: mailOptions.from, // formatted sender address
        fromName: `${comment.author.firstName} ${comment.author.lastName}`.trim(),
        toEmails: [mailOptions.to],
        ccEmails: task.reporters?.map((r) => r.email) ?? [],
        headers: {},
        bccEmails: [],
        replyTo: null,
        bodyText: null,
        bodyHtml: htmlContent,
        textSignature: null,
        htmlSignature: null,
        rawSize: Buffer.byteLength(htmlContent, 'utf-8'),
        hasAttachments: false,
        importance: null,
        converted: false,
        status: 'PENDING',
        isSpam: false,
        spamScore: null,
        emailDate: new Date(),
        receivedAt: new Date(),
        processedAt: null,
      },
    });

    // Update task to link new inbox message
    await this.prisma.task.update({
      where: { id: task.id },
      data: { inboxMessageId: newInboxMessage.id, emailThreadId: emailMessageId },
    });

    await this.prisma.taskComment.update({
      where: { id: comment.id },
      data: {
        emailMessageId,
        sentAsEmail: true,
        emailRecipients: [mailOptions.to],
        emailSentAt: new Date(),
      },
    });

    return {
      success: true,
      messageId: info.messageId,
      recipients: [mailOptions.to],
    };
  }

  private getTransporter(account: EmailAccount) {
    return this.createBasicTransporter(account);
  }

  private createBasicTransporter(
    account: EmailAccount,
  ): Transporter<SMTPTransport.SentMessageInfo> {
    try {
      if (!account.smtpPassword) {
        throw new Error('SMTP password is required');
      }
      const smtpPassword = this.crypto.decrypt(account.smtpPassword);

      type SecureVersion = 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';

      const transportOptions: SMTPTransport.Options = {
        host: account.smtpHost!,
        port: account.smtpPort!,
        secure: account.smtpPort === 465,
        requireTLS: account.smtpRequireTls === true, // Force STARTTLS upgrade
        auth: {
          user: account.smtpUsername!,
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: account.smtpTlsRejectUnauth !== false,
          minVersion: (account.smtpTlsMinVersion || 'TLSv1.2') as SecureVersion,
          ...(account.smtpServername && { servername: account.smtpServername }),
        },
      };

      return nodemailer.createTransport(transportOptions);
    } catch (error) {
      this.logger.error(`Failed to create basic transporter:`, error.message);
      throw new Error(`SMTP authentication failed: ${error.message}`);
    }
  }

  private formatSenderAddress(author: any, account: EmailAccount): string {
    const displayName = account.displayName || `${author.firstName} ${author.lastName}`.trim();
    return `${displayName} <${account.emailAddress}>`;
  }

  private buildReferencesHeader(message: any): string {
    const references = [...(message.references || [])];

    if (message.messageId && !references.includes(message.messageId)) {
      references.push(message.messageId);
    }

    return references.join(' ');
  }

  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const domain = process.env.EMAIL_DOMAIN || 'taskosaur.com';
    return `<${timestamp}.${random}@${domain}>`;
  }

  async sendAutoReply(messageId: string) {
    const message = await this.prisma.inboxMessage.findUnique({
      where: { id: messageId },
      include: {
        projectInbox: {
          include: { emailAccount: true },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (!message.projectInbox.autoReplyEnabled || !message.projectInbox.autoReplyTemplate) {
      return;
    }

    const account = message.projectInbox.emailAccount;
    if (!account) {
      return;
    }

    try {
      const transporter = this.getTransporter(account);

      const mailOptions = {
        from: `${message.projectInbox.name} <${account.emailAddress}>`,
        to: message.fromEmail,
        subject: `Re: ${message.subject}`,
        text: message.projectInbox.autoReplyTemplate,
        html: message.projectInbox.autoReplyTemplate.replace(/\n/g, '<br>'),
        inReplyTo: message.messageId,
        messageId: this.generateMessageId(),
      };

      await transporter.sendMail(mailOptions);

      this.logger.log(`Auto-reply sent for message ${messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send auto-reply for message ${messageId}:`, error.message);
    }
  }

  async testEmailConfiguration(accountId: string) {
    const account = await this.prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Email account not found');
    }

    const results = {
      smtp: { success: false, message: '' },
      imap: { success: false, message: '' },
    };

    try {
      const transporter = this.getTransporter(account);
      await transporter.verify();

      results.smtp = { success: true, message: 'SMTP connection successful' };
      this.logger.log(`SMTP test passed for ${account.emailAddress}`);
    } catch (error) {
      this.logger.error(`SMTP test failed for ${account.emailAddress}:`, error.message);
      results.smtp = { success: false, message: `SMTP: ${error.message}` };
    }

    try {
      if (!account.imapPassword) {
        throw new Error('IMAP password is required');
      }

      const imapPassword = this.crypto.decrypt(account.imapPassword);

      type TLSMinVersion = 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';

      const imapOptions: ImapFlowOptions = {
        host: account.imapHost!,
        port: account.imapPort || 993,
        secure: account.imapUseSsl !== false,
        auth: {
          user: account.imapUsername!,
          pass: imapPassword,
        },
        logger: false,
        tls: {
          rejectUnauthorized: account.imapTlsRejectUnauth !== false,
          minVersion: (account.imapTlsMinVersion || 'TLSv1.2') as TLSMinVersion,
        },
      };

      const client = new ImapFlow(imapOptions);

      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('IMAP connection timeout after 30 seconds')), 30000),
        ),
      ]);

      await client.logout();

      results.imap = { success: true, message: 'IMAP connection successful' };
      this.logger.log(`IMAP test passed for ${account.emailAddress}`);
    } catch (error) {
      this.logger.error(`IMAP test failed for ${account.emailAddress}:`, error.message);
      results.imap = { success: false, message: `IMAP: ${error.message}` };
    }

    const allSuccess = results.smtp.success && results.imap.success;

    if (allSuccess) {
      return {
        success: true,
        message: 'Both IMAP and SMTP connections successful',
        details: results,
      };
    } else {
      const errors: string[] = [];
      if (!results.smtp.success) errors.push(results.smtp.message);
      if (!results.imap.success) errors.push(results.imap.message);

      return {
        success: false,
        message: errors.join('; '),
        details: results,
      };
    }
  }
}
