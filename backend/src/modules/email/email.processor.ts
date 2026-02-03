import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailJobData, EmailTemplate } from './dto/email.dto';
import { QueueProcessor } from '../queue/decorators/queue-processor.decorator';
import { IJob } from '../queue/interfaces/job.interface';
import { QueueService } from '../queue/services/queue.service';
import { convertMarkdownToHtml } from '../../common/utils/markdown.util';
import { sanitizeHtml } from '../../common/utils/sanitizer.util';

@QueueProcessor('email')
export class EmailProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private configService: ConfigService,
    private queueService: QueueService,
  ) {
    this.initializeTransporter();
  }

  onModuleInit() {
    try {
      const adapter = this.queueService.getAdapter();
      if (!adapter) {
        this.logger.error('Queue adapter not available. Email jobs will not be processed.');
        return;
      }

      // Ensure the queue is registered
      try {
        this.queueService.registerQueue('email');
      } catch {
        // Queue might already be registered, which is fine
      }

      // Get the queue to extract its configuration
      const queue = this.queueService.getQueue<EmailJobData>('email');
      const underlyingQueue = (
        queue as { getUnderlyingQueue?: () => { opts?: { prefix?: string; connection?: any } } }
      ).getUnderlyingQueue?.();

      // Extract prefix and connection from queue to ensure worker matches
      const queuePrefix = underlyingQueue?.opts?.prefix || 'default';
      const queueConnection = underlyingQueue?.opts?.connection;

      // Create worker with the SAME connection and prefix as the queue
      // This is the critical fix: worker must use same Redis prefix as queue
      const processor = async (job: IJob<EmailJobData>) => {
        return await this.process(job);
      };

      const workerConfig: any = {
        connection: queueConnection,
        prefix: queuePrefix,
      };

      adapter.createWorker('email', processor, workerConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to register EmailProcessor as worker: ${errorMessage}`);
    }
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = Number(this.configService.get<number>('SMTP_PORT', 587));
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn('SMTP configuration missing. Email sending will be simulated.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        // Add TLS configuration for AWS SES compatibility
        tls: {
          rejectUnauthorized: this.configService.get('NODE_ENV') !== 'development',
        },
      });
    } catch (error) {
      this.logger.error('Failed to initialize SMTP transporter:', error);
      this.transporter = null as any;
    }

    // Note: SMTP connection will be verified only when sending emails
  }

  async process(job: IJob<EmailJobData>) {
    return await this.handleSendEmail(job);
  }

  async handleSendEmail(job: IJob<EmailJobData>) {
    const { to, subject, template, data } = job.data;
    const smtpFrom = this.configService.get<string>('SMTP_FROM', 'noreply@taskosaur.com');

    try {
      const html = this.generateEmailHTML(template, data);
      const text = this.generateEmailText(template, data);

      if (this.transporter) {
        const result = await this.transporter.sendMail({
          from: smtpFrom,
          to,
          subject,
          html,
          text,
        });

        this.logger.log(`Email sent successfully to ${to} using template ${template}`);
        return { success: true, messageId: result.messageId };
      } else {
        // Simulate email sending for development
        this.logger.log(
          `📧 EMAIL SIMULATION - To: ${to}, Subject: ${subject}, Template: ${template}`,
        );
        return { success: true, simulated: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}:`, errorMessage);

      // Log additional error details for common SMTP errors
      if (error instanceof Error) {
        if (errorMessage.includes('ECONNREFUSED')) {
          this.logger.error(`Connection refused - Check SMTP_HOST and SMTP_PORT`);
        } else if (errorMessage.includes('EAUTH')) {
          this.logger.error(`Authentication failed - Check SMTP_USER and SMTP_PASS`);
        } else if (errorMessage.includes('ETIMEDOUT')) {
          this.logger.error(`Connection timeout - Check network connectivity and SMTP settings`);
        }
      }

      throw error;
    }
  }

  private generateEmailHTML(template: EmailTemplate, data: any): string {
    const baseStyles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .content { padding: 40px; }
        .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .task-info { background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6366f1; }
        .priority-high { border-left-color: #ef4444; }
        .priority-medium { border-left-color: #f59e0b; }
        .priority-low { border-left-color: #10b981; }
        .footer { text-align: center; padding: 30px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        p { margin: 12px 0; }
        .info-section { margin: 20px 0; padding: 20px; background: #f9fafb; border-radius: 6px; }
        .button-container { text-align: center; margin: 25px 0; color:#f9fafb }
        /* Markdown Styles */
        .markdown-content ul, .markdown-content ol { padding-left: 20px; margin: 10px 0; }
        .markdown-content blockquote { border-left: 4px solid #e5e7eb; padding-left: 16px; color: #6b7280; font-style: italic; margin: 10px 0; }
        .markdown-content code { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
        .markdown-content pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
      </style>
    `;
    let bodyContent = '';
    switch (template) {
      case EmailTemplate.TASK_ASSIGNED:
        bodyContent = `
           <div class="container">
            <div class="content">
              <p>A new task has been assigned to you by ${data.assignedBy.name}.</p>

              <div class="task-info priority-${(data.task.priority as string | undefined)?.toLowerCase()}">
                <p><strong>${data.task.key}:</strong> ${data.task.title}</p>
                <p><strong>Project:</strong> ${data.project.name}</p>
                <p><strong>Priority:</strong> ${data.task.priority}</p>
                ${data.task.dueDate ? `<p><strong>Due Date:</strong> ${new Date(data.task.dueDate as string | number | Date).toLocaleDateString()}</p>` : ''}
                ${data.task.description ? `<div class="markdown-content"><strong>Description:</strong> ${sanitizeHtml(convertMarkdownToHtml(String(data.task.description)))}</div>` : ''}
              </div>
              
              <div class="button-container">
                <a href="${data.taskUrl}" class="button">View Task</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;
      case EmailTemplate.DUE_DATE_REMINDER:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>Your assigned task is due in ${data.task.hoursUntilDue} hours.</p>

              <div class="task-info priority-${(data.task.priority as string | undefined)?.toLowerCase()}">
                <p><strong>${data.task.key}:</strong> ${data.task.title}</p>
                <p><strong>Project:</strong> ${data.project.name}</p>
                <p><strong>Due Date:</strong> ${new Date(data.task.dueDate as string | number | Date).toLocaleString()}</p>
                <p><strong>Priority:</strong> ${data.task.priority}</p>
              </div>
              
              <div class="button-container">
                <a href="${data.taskUrl}" class="button">View Task</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.TASK_STATUS_CHANGED:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>Task status has been updated.</p>
              
              <div class="task-info">
                <p><strong>${data.task.key}:</strong> ${data.task.title}</p>
                <p><strong>Project:</strong> ${data.project.name}</p>
                <p><strong>Status:</strong> ${data.oldStatus.name} → ${data.newStatus.name}</p>
              </div>
              
              <div class="button-container">
                <a href="${data.taskUrl}" class="button">View Task</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.WEEKLY_SUMMARY:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>Your weekly productivity summary:</p>
              
              <div class="task-info">
                <p><strong>Tasks Completed:</strong> ${data.summary.tasksCompleted}</p>
                <p><strong>Tasks Assigned:</strong> ${data.summary.tasksAssigned}</p>
                <p><strong>Time Tracked:</strong> ${data.summary.totalTimeSpent} hours</p>
              </div>
              
              ${
                data.summary.overdueTasks.length > 0
                  ? `
                <div class="task-info priority-high">
                  <p><strong>Overdue Tasks (${data.summary.overdueTasks.length})</strong></p>
                  ${(
                    data.summary.overdueTasks as Array<{
                      url: string;
                      key: string;
                      title: string;
                      project: string;
                    }>
                  )
                    .map(
                      (task) => `
                    <p><a href="${task.url}">${task.key}: ${task.title}</a> (${task.project})</p>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : '<p>All tasks are up to date.</p>'
              }
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.PASSWORD_RESET:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>A password reset has been requested for your Taskosaur account.</p>
              
              <div class="task-info">
                <p>Click the button below to reset your password.</p>
                <p><strong>This link expires in ${data.expiresIn}</strong></p>
              </div>
              
              <div class="button-container">
                <a href="${data.resetUrl}" class="button">Reset Password</a>
              </div>
              
              <div class="info-section">
                <p>If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.PASSWORD_RESET_CONFIRMATION:
        bodyContent = `
        <div class="container">
          <div class="content">
            <p>Your Taskosaur account password has been successfully reset.</p>
            
            <div class="task-info">
              <p><strong>Reset completed:</strong> ${data.resetTime}</p>
              <p>All existing sessions have been terminated for security.</p>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">Login to Your Account</a>
            </div>
            
            <div class="info-section">
              <p>If you didn't authorize this change, contact support immediately at ${data.supportEmail || 'support@taskosaur.com'}</p>
            </div>
          </div>
          <div class="footer">
            <p>Taskosaur - Modern Project Management</p>
          </div>
        </div>
      `;
        break;

      case EmailTemplate.SEND_INVITATION:
        bodyContent = `
        <div class="container">
          <div class="content">
            <p>${data.inviterName} has invited you to join their ${(data.entityType as string).toLowerCase()} on Taskosaur.</p>
            
            <div class="task-info">
              <p><strong>${data.entityType}:</strong> ${data.entityName}</p>
              <p><strong>Role:</strong> ${data.role}</p>
              <p><strong>Invited by:</strong> ${data.inviterName}</p>
              <p><strong>Expires:</strong> ${data.expiresAt}</p>
            </div>
            
            <div class="button-container">
              <a href="${data.invitationUrl}" class="button">View Invitation</a>
            </div>
            
            <div class="info-section">
              <p>This invitation expires on <strong>${data.expiresAt}</strong>. Please respond before this date.</p>
            </div>
          </div>
          <div class="footer">
            <p>Taskosaur - Modern Project Management</p>
          </div>
        </div>
      `;
        break;

      case EmailTemplate.DIRECT_ADD_NOTIFICATION:
        bodyContent = `
            <div class="container">
              <div class="content">
                <p>${data.inviterName} has added you to their ${(data.entityType as string).toLowerCase()} on Taskosaur.</p>
                
                <div class="task-info">
                  <p><strong>${data.entityType}:</strong> ${data.entityName}</p>
                  ${data.organizationName ? `<p><strong>Organization:</strong> ${data.organizationName}</p>` : ''}
                  <p><strong>Role:</strong> ${data.role}</p>
                  <p><strong>Added by:</strong> ${data.inviterName}</p>
                </div>
                
                <div class="button-container">
                  <a href="${data.entityUrl}" class="button">Go to ${data.entityType}</a>
                </div>
              </div>
              <div class="footer">
                <p>Taskosaur - Modern Project Management</p>
              </div>
            </div>
          `;
        break;

      case EmailTemplate.INVITATION_ACCEPTED:
        bodyContent = `
        <div class="container">
          <div class="content">
            <p>${data.accepterName} has accepted your invitation to join the project.</p>
            
            <div class="task-info">
              <p><strong>Name:</strong> ${data.accepterName}</p>
              <p><strong>Email:</strong> ${data.accepterEmail}</p>
              <p><strong>Project:</strong> ${data.projectName}</p>
              <p><strong>Role:</strong> ${data.role || 'Team Member'}</p>
              <p><strong>Joined:</strong> ${data.acceptedDate}</p>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${data.projectId}" class="button">View Project</a>
            </div>
          </div>
          <div class="footer">
            <p>Taskosaur - Modern Project Management</p>
          </div>
        </div>
      `;
        break;

      case EmailTemplate.INVITATION_DECLINED:
        bodyContent = `
        <div class="container">
          <div class="content">
            <p>${data.declinerName} has declined your invitation to join the project.</p>
            
            <div class="task-info">
              <p><strong>Name:</strong> ${data.declinerName}</p>
              <p><strong>Email:</strong> ${data.declinerEmail}</p>
              <p><strong>Project:</strong> ${data.projectName}</p>
              <p><strong>Declined:</strong> ${data.declinedDate}</p>
              ${data.declineReason ? `<p><strong>Reason:</strong> ${data.declineReason}</p>` : ''}
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${data.projectId}/team" class="button">Manage Team</a>
            </div>
          </div>
          <div class="footer">
            <p>Taskosaur - Modern Project Management</p>
          </div>
        </div>
      `;
        break;

      case EmailTemplate.INVITATION_EXPIRED:
        bodyContent = `
        <div class="container">
          <div class="content">
            <p>Your invitation to ${data.inviteeName} has expired without a response.</p>
            
            <div class="task-info">
              <p><strong>Invited user:</strong> ${data.inviteeName}</p>
              <p><strong>Email:</strong> ${data.inviteeEmail}</p>
              <p><strong>Project:</strong> ${data.projectName}</p>
              <p><strong>Expired:</strong> ${data.expiredDate}</p>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${data.projectId}/invite?email=${data.inviteeEmail}" class="button">Send New Invitation</a>
            </div>
          </div>
          <div class="footer">
            <p>Taskosaur - Modern Project Management</p>
          </div>
        </div>
      `;
        break;

      case EmailTemplate.TASK_COMMENTED:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>${data.commenter.name} commented on a task you're involved with.</p>
              
              <div class="task-info">
                <p><strong>Task:</strong> ${data.task.key} - ${data.task.title}</p>
                <p><strong>Project:</strong> ${data.project.name}</p>
                <p><strong>Comment by:</strong> ${data.commenter.name}</p>
                <div class="markdown-content"><strong>Comment:</strong><br/>${sanitizeHtml(convertMarkdownToHtml(String(data.comment.content)))}</div>
              </div>
              
              <div class="button-container">
                <a href="${data.taskUrl}" class="button">View Task & Comment</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.PROJECT_CREATED:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>${data.creator.name} created a new project.</p>
              
              <div class="task-info">
                <p><strong>Project:</strong> ${data.project.name}</p>
                ${data.project.description ? `<div class="markdown-content"><strong>Description:</strong><br/>${sanitizeHtml(convertMarkdownToHtml(String(data.project.description)))}</div>` : ''}
                <p><strong>Workspace:</strong> ${data.workspace.name}</p>
                <p><strong>Organization:</strong> ${data.organization.name}</p>
                <p><strong>Created by:</strong> ${data.creator.name}</p>
              </div>
              
              <div class="button-container">
                <a href="${data.projectUrl}" class="button">View Project</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.PROJECT_UPDATED:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>${data.updater.name} updated a project you're a member of.</p>
              
              <div class="task-info">
                <p><strong>Project:</strong> ${data.project.name}</p>
                ${data.project.description ? `<div class="markdown-content"><strong>Description:</strong><br/>${sanitizeHtml(convertMarkdownToHtml(String(data.project.description)))}</div>` : ''}
                <p><strong>Workspace:</strong> ${data.workspace.name}</p>
                <p><strong>Organization:</strong> ${data.organization.name}</p>
                <p><strong>Updated by:</strong> ${data.updater.name}</p>
              </div>
              
              <div class="button-container">
                <a href="${data.projectUrl}" class="button">View Project</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.WORKSPACE_INVITED:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>You've been invited to join a workspace on Taskosaur.</p>
              
              <div class="task-info">
                <p><strong>Workspace:</strong> ${data.entityName || 'Workspace'}</p>
                ${data.organizationName ? `<p><strong>Organization:</strong> ${data.organizationName}</p>` : ''}
                <p><strong>Invited by:</strong> ${data.inviterName}</p>
              </div>
              
              <div class="button-container">
                <a href="${data.invitationUrl || data.entityUrl || '#'}" class="button">View Invitation</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.MENTION:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>${data.mentioner.name} mentioned you.</p>
              
              <div class="task-info">
                <p><strong>${data.entityType === 'task' ? 'Task' : 'Comment'}:</strong> ${data.entityName || data.entity?.title || 'Item'}</p>
                ${data.entity?.key ? `<p><strong>Key:</strong> ${data.entity.key}</p>` : ''}
                <p><strong>Mentioned by:</strong> ${data.mentioner.name}</p>
              </div>
              
              <div class="button-container">
                <a href="${data.entityUrl}" class="button">View ${data.entityType === 'task' ? 'Task' : 'Comment'}</a>
              </div>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      case EmailTemplate.SYSTEM:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>${data.notification.title}</p>
              
              <div class="task-info">
                <p>${data.notification.message}</p>
              </div>
              
              ${
                data.notification.actionUrl
                  ? `
              <div class="button-container">
                <a href="${data.notification.actionUrl}" class="button">View Details</a>
              </div>
              `
                  : ''
              }
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
        break;

      default:
        bodyContent = `
          <div class="container">
            <div class="content">
              <p>You have received a new notification from Taskosaur.</p>
              <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
            <div class="footer">
              <p>Taskosaur - Modern Project Management</p>
            </div>
          </div>
        `;
    }
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>Taskosaur - ${template}</title>
      ${baseStyles}
    </head>
    <body>
      ${bodyContent}
    </body>
    </html>
    `;
  }

  private generateEmailText(template: EmailTemplate, data: any): string {
    switch (template) {
      case EmailTemplate.TASK_ASSIGNED:
        return `
Task Assigned: ${data.task.title}

Hi ${data.assignee.name}!

You've been assigned a new task by ${data.assignedBy.name}.

Task: ${data.task.key} - ${data.task.title}
Project: ${data.project.name}
Priority: ${data.task.priority}
${data.task.dueDate ? `Due Date: ${new Date(data.task.dueDate as string | number | Date).toLocaleDateString()}` : ''}

${data.task.description ? `Description: ${data.task.description}` : ''}

View task: ${data.taskUrl}

Happy coding! 🚀

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.DUE_DATE_REMINDER:
        return `
Task Due Soon: ${data.task.title}

Hi ${data.assignee.name}!

Your task is due in ${data.task.hoursUntilDue} hours.

Task: ${data.task.key} - ${data.task.title}
Project: ${data.project.name}
Due Date: ${new Date(data.task.dueDate as string | number | Date).toLocaleString()}
Priority: ${data.task.priority}

View task: ${data.taskUrl}

Don't let it slip! ⚡

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.PASSWORD_RESET:
        return `
Reset Your Taskosaur Password

Hi ${data.userName}!

We received a request to reset your Taskosaur account password.

PASSWORD RESET REQUEST
If you requested this password reset, click the link below to set a new password:

${data.resetUrl}

This link expires in ${data.expiresIn}.

SECURITY NOTICE:
⚠️ If you didn't request this password reset, you can safely ignore this email
⚠️ Your password won't be changed until you access the link above and create a new one  
⚠️ This reset link will expire in 24 hours for your security

If you have any questions, please contact our support team.

Stay secure! 🛡️

--
Taskosaur - Modern Project Management
This email was sent because a password reset was requested for your account.
        `;

      case EmailTemplate.TASK_STATUS_CHANGED:
        return `
Task Status Changed: ${data.task.title}

The status of a task you're involved with has been updated.

Task: ${data.task.key} - ${data.task.title}
Project: ${data.project.name}
Status: ${data.oldStatus.name} → ${data.newStatus.name}

View task: ${data.taskUrl}

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.TASK_COMMENTED:
        return `
New Comment on Task: ${data.task.title}

Hi ${data.recipient.name}!

${data.commenter.name} commented on a task you're involved with.

Task: ${data.task.key} - ${data.task.title}
Project: ${data.project.name}
Comment by: ${data.commenter.name}
Comment: ${data.comment.content}

View task and comment: ${data.taskUrl}

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.PROJECT_CREATED:
        return `
New Project Created: ${data.project.name}

Hi ${data.recipient.name}!

${data.creator.name} created a new project.

Project: ${data.project.name}
${data.project.description ? `Description: ${data.project.description}` : ''}
Workspace: ${data.workspace.name}
Organization: ${data.organization.name}
Created by: ${data.creator.name}

View project: ${data.projectUrl}

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.PROJECT_UPDATED:
        return `
Project Updated: ${data.project.name}

Hi ${data.recipient.name}!

${data.updater.name} updated a project you're a member of.

Project: ${data.project.name}
${data.project.description ? `Description: ${data.project.description}` : ''}
Workspace: ${data.workspace.name}
Organization: ${data.organization.name}
Updated by: ${data.updater.name}

View project: ${data.projectUrl}

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.WORKSPACE_INVITED:
        return `
Workspace Invitation

You've been invited to join a workspace on Taskosaur.

Workspace: ${data.entityName || 'Workspace'}
${data.organizationName ? `Organization: ${data.organizationName}` : ''}
Invited by: ${data.inviterName}

View invitation: ${data.invitationUrl || data.entityUrl || '#'}

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.MENTION:
        return `
You Were Mentioned

Hi ${data.mentionedUser.name}!

${data.mentioner.name} mentioned you in a ${data.entityType === 'task' ? 'task' : 'comment'}.

${data.entityType === 'task' ? 'Task' : 'Comment'}: ${data.entityName || data.entity?.title || 'Item'}
${data.entity?.key ? `Key: ${data.entity.key}` : ''}
Mentioned by: ${data.mentioner.name}

View ${data.entityType === 'task' ? 'task' : 'comment'}: ${data.entityUrl}

--
Taskosaur - Modern Project Management
        `;

      case EmailTemplate.SYSTEM:
        return `
${data.notification.title}

${data.notification.message}

${data.notification.actionUrl ? `View details: ${data.notification.actionUrl}` : ''}

--
Taskosaur - Modern Project Management
        `;

      default:
        return `Taskosaur Notification\n\n${JSON.stringify(data, null, 2)}`;
    }
  }
}
