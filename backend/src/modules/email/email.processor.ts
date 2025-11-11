import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailJobData, EmailTemplate } from './dto/email.dto';
import { QueueProcessor } from '../queue/decorators/queue-processor.decorator';
import { IJob } from '../queue/interfaces/job.interface';

@QueueProcessor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn('SMTP configuration missing. Email sending will be simulated.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Note: SMTP connection will be verified only when sending emails
  }

  async process(job: IJob<EmailJobData>) {
    return this.handleSendEmail(job);
  }

  async handleSendEmail(job: IJob<EmailJobData>) {
    const { to, subject, template, data } = job.data;

    try {
      const html = this.generateEmailHTML(template, data);
      const text = this.generateEmailText(template, data);
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.configService.get<string>('SMTP_FROM', 'noreply@taskosaur.com'),
          to,
          subject,
          html,
          text,
        });

        this.logger.log(`Email sent successfully to ${to} using template ${template}`);
      } else {
        // Simulate email sending for development
        this.logger.log(
          `📧 EMAIL SIMULATION - To: ${to}, Subject: ${subject}, Template: ${template}`,
        );
        this.logger.debug('Email data:', JSON.stringify(data, null, 2));
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
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
                ${data.task.description ? `<p><strong>Description:</strong> ${data.task.description}</p>` : ''}
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

      default:
        return `Taskosaur Notification\n\n${JSON.stringify(data, null, 2)}`;
    }
  }
}
