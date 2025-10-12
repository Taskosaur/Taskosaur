import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/crypto.service';
import { EmailAccount } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { decode } from 'html-entities';

@Injectable()
export class EmailReplyService {
  private readonly logger = new Logger(EmailReplyService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) { }

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
      throw new Error('Task is not linked to an email thread');
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

      const transporter = await this.getTransporter(account);
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
        const hasEscapedHtml = /&lt;|&gt;|&amp;|&quot;|&#39;/.test(inboxMessage.projectInbox.emailSignature);
        const htmlSignature = hasEscapedHtml ? this.decodeHtml(inboxMessage.projectInbox.emailSignature) : inboxMessage.projectInbox.emailSignature;
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
          emailRecipients: [
            inboxMessage.fromEmail,
            ...inboxMessage.ccEmails,
          ],
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

  private async getTransporter(account: EmailAccount) {
    return this.createBasicTransporter(account);
  }

  private async createBasicTransporter(account: EmailAccount) {
    try {
      const smtpPassword = await this.crypto.decrypt(account.smtpPassword!);

      return nodemailer.createTransport({
        host: account.smtpHost!,
        port: account.smtpPort!,
        secure: account.smtpPort === 465,
        auth: {
          user: account.smtpUsername!,
          pass: smtpPassword,
        },
      });
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
      const transporter = await this.getTransporter(account);

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

    try {
      const transporter = await this.getTransporter(account);

      const isValid = await transporter.verify();

      if (isValid) {
        this.logger.log(`Email configuration test passed for ${account.emailAddress}`);
        return { success: true, message: 'Email configuration is valid' };
      } else {
        return { success: false, message: 'Email configuration verification failed' };
      }
    } catch (error) {
      this.logger.error(`Email configuration test failed:`, error.message);
      return { success: false, message: error.message };
    }
  }
}
