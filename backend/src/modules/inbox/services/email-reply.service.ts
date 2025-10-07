import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/crypto.service';
import { EmailAccount } from '@prisma/client';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailReplyService {
  private readonly logger = new Logger(EmailReplyService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) { }

  async sendCommentAsEmail(commentId: string) {
    // 1️⃣ Fetch the comment with all necessary relations
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

    // 2️⃣ Validate email reply permissions
    if (!comment.task.allowEmailReplies) {
      throw new Error('Email replies are not enabled for this task');
    }

    // 3️⃣ Ensure the task is linked to an inbox message
    const inboxMessage = comment.task.inboxMessage;
    if (!inboxMessage) {
      throw new Error('Task is not linked to an email thread');
    }

    // 4️⃣ Ensure the comment hasn't already been sent as email
    if (comment.sentAsEmail) {
      throw new Error('Comment has already been sent as email');
    }

    const account = inboxMessage.projectInbox.emailAccount;
    if (!account) {
      throw new Error('No email account configured for this inbox');
    }

    try {
      this.logger.log(`Sending comment ${commentId} as email reply`);

      // 5️⃣ Create transporter
      const transporter = await this.getTransporter(account);

      // 6️⃣ Generate unique message ID
      const emailMessageId = this.generateMessageId();

      // 7️⃣ Compose email
      const mailOptions = {
        from: this.formatSenderAddress(comment.author, account),
        to: inboxMessage.fromEmail,
        cc: inboxMessage.ccEmails?.length ? inboxMessage.ccEmails.join(',') : undefined,
        subject: `Re: ${inboxMessage.subject}`,
        text: this.formatCommentAsText(comment, inboxMessage.projectInbox),
        html: this.formatCommentAsHtml(comment, inboxMessage.projectInbox),
        inReplyTo: inboxMessage.messageId,
        references: this.buildReferencesHeader(inboxMessage),
        messageId: emailMessageId,
      };

      // 8️⃣ Optional signature
      if (inboxMessage.projectInbox.emailSignature) {
        mailOptions.text += `\n\n${inboxMessage.projectInbox.emailSignature}`;
        mailOptions.html += `<br><br>${inboxMessage.projectInbox.emailSignature.replace(/\n/g, '<br>')}`;
      }

      // 9️⃣ Send email
      const info = await transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully: ${info.messageId}`);

      // 🔟 Update comment
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

  private formatCommentAsText(comment: any, inbox: any): string {
    const authorName = `${comment.author.firstName} ${comment.author.lastName}`.trim();
    const projectName = comment.task.project.name;

    return `${comment.content}

---
${authorName} replied to this task in ${projectName}
View this task: ${process.env.FRONTEND_URL || 'https://app.taskosaur.com'}/tasks/${comment.task.id}
`;
  }

  private formatCommentAsHtml(comment: any, inbox: any): string {
    const authorName = `${comment.author.firstName} ${comment.author.lastName}`.trim();
    const projectName = comment.task.project.name;
    const taskUrl = `${process.env.FRONTEND_URL || 'https://app.taskosaur.com'}/tasks/${comment.task.id}`;

    // Convert markdown-style content to basic HTML
    const htmlContent = this.markdownToBasicHtml(comment.content);

    return `
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <div style="margin-bottom: 20px;">
    ${htmlContent}
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

  <div style="color: #666; font-size: 12px;">
    <p><strong>${authorName}</strong> replied to this task in <strong>${projectName}</strong></p>
    <p><a href="${taskUrl}" style="color: #007bff;">View this task</a></p>
  </div>
</div>
    `.trim();
  }

  private markdownToBasicHtml(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // *italic*
      .replace(/`(.*?)`/g, '<code>$1</code>') // `code`
      .replace(/\n\n/g, '</p><p>') // paragraphs
      .replace(/\n/g, '<br>') // line breaks
      .replace(/^/, '<p>') // start paragraph
      .replace(/$/, '</p>'); // end paragraph
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

  // Method to send auto-reply when message is received
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
      return; // Auto-reply not configured
    }

    const account = message.projectInbox.emailAccount;
    if (!account) {
      return; // No email account configured
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

  // Method to test email configuration
  async testEmailConfiguration(accountId: string) {
    const account = await this.prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Email account not found');
    }

    try {
      const transporter = await this.getTransporter(account);

      // Verify transporter configuration
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