export interface EmailTemplateData {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: 'auto-reply' | 'welcome' | 'support' | 'notification' | 'custom';
  variables: string[];
  isDefault: boolean;
  description?: string;
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateData[] = [
  // Auto-Reply Templates
  {
    id: 'auto-reply-support',
    name: 'Auto Reply - Support',
    subject: 'Re: {{subject}}',
    content: `Thank you for contacting our support team.

We have received your message and created ticket #{{taskNumber}} to track your request.

Our team will review your message and respond within 24 hours during business days.

If this is urgent, please reply with "URGENT" in the subject line.

Best regards,
{{projectName}} Support Team

---
This is an automated response. Please do not reply to this email directly.`,
    category: 'auto-reply',
    variables: ['subject', 'taskNumber', 'projectName'],
    isDefault: true,
    description: 'Standard auto-reply for support requests',
  },
  {
    id: 'auto-reply-general',
    name: 'Auto Reply - General Inquiry',
    subject: 'Thank you for your message',
    content: `Hello,

Thank you for reaching out to us. We have received your message and will get back to you soon.

Ticket Reference: #{{taskNumber}}
Project: {{projectName}}

Expected Response Time: 2-3 business days

For faster support, please check our FAQ at {{websiteUrl}}/help

Best regards,
{{projectName}} Team`,
    category: 'auto-reply',
    variables: ['taskNumber', 'projectName', 'websiteUrl'],
    isDefault: true,
    description: 'General auto-reply for inquiries',
  },
  {
    id: 'auto-reply-out-of-hours',
    name: 'Auto Reply - Out of Hours',
    subject: "Out of Hours - We'll respond soon",
    content: `Thank you for your email.

We have received your message outside of our normal business hours.

Business Hours: Monday-Friday, 9:00 AM - 6:00 PM {{timezone}}

Your ticket: #{{taskNumber}}

We will respond to your message during our next business day. For urgent matters, please contact our emergency line at {{emergencyPhone}}.

Best regards,
{{projectName}} Team`,
    category: 'auto-reply',
    variables: ['taskNumber', 'timezone', 'emergencyPhone', 'projectName'],
    isDefault: true,
    description: 'Auto-reply for messages received outside business hours',
  },

  // Welcome Templates
  {
    id: 'welcome-new-customer',
    name: 'Welcome - New Customer',
    subject: 'Welcome to {{projectName}}!',
    content: `Welcome to {{projectName}}!

We're excited to have you on board. This email confirms that we've set up your account and you're ready to get started.

Your Support Details:
- Support Email: {{supportEmail}}
- Ticket Reference: #{{taskNumber}}
- Account Manager: {{assigneeName}}

Getting Started:
1. Visit our knowledge base at {{websiteUrl}}/docs
2. Join our community forum
3. Schedule an onboarding call if needed

If you have any questions, simply reply to this email and we'll help you out.

Welcome aboard!
{{projectName}} Team`,
    category: 'welcome',
    variables: ['projectName', 'supportEmail', 'taskNumber', 'assigneeName', 'websiteUrl'],
    isDefault: true,
    description: 'Welcome email for new customers',
  },

  // Support Templates
  {
    id: 'support-issue-resolved',
    name: 'Support - Issue Resolved',
    subject: 'Issue Resolved - {{subject}}',
    content: `Good news! We've resolved your support request.

Ticket: #{{taskNumber}}
Issue: {{subject}}
Resolution: {{resolution}}

The issue has been marked as resolved. If you're still experiencing problems or have any questions, please reply to this email and we'll reopen your ticket.

We'd love to hear your feedback about our support. Reply with:
- 👍 Great support!
- 👎 Could be better

Thank you for choosing {{projectName}}.

Best regards,
{{assigneeName}}
{{projectName}} Support Team`,
    category: 'support',
    variables: ['subject', 'taskNumber', 'resolution', 'projectName', 'assigneeName'],
    isDefault: true,
    description: 'Template for resolved support tickets',
  },
  {
    id: 'support-need-info',
    name: 'Support - Need More Information',
    subject: 'Re: {{subject}} - Additional Information Needed',
    content: `Hi {{customerName}},

Thank you for contacting us about: {{subject}}

Ticket: #{{taskNumber}}

To help us resolve your issue quickly, we need some additional information:

{{additionalInfoNeeded}}

Please reply to this email with the requested details, and we'll get back to you as soon as possible.

If you have any questions about what information we need, feel free to ask.

Best regards,
{{assigneeName}}
{{projectName}} Support Team`,
    category: 'support',
    variables: [
      'subject',
      'customerName',
      'taskNumber',
      'additionalInfoNeeded',
      'assigneeName',
      'projectName',
    ],
    isDefault: true,
    description: 'Request additional information from customer',
  },
  {
    id: 'support-escalated',
    name: 'Support - Issue Escalated',
    subject: 'Escalated: {{subject}}',
    content: `Your support request has been escalated for priority handling.

Ticket: #{{taskNumber}}
Issue: {{subject}}
Escalated By: {{escalatedBy}}
Reason: {{escalationReason}}

Our senior team is now handling your request and will provide an update within {{escalationSla}} hours.

We apologize for any inconvenience and appreciate your patience.

You can track progress at: {{taskUrl}}

Best regards,
{{projectName}} Management Team`,
    category: 'support',
    variables: [
      'taskNumber',
      'subject',
      'escalatedBy',
      'escalationReason',
      'escalationSla',
      'taskUrl',
      'projectName',
    ],
    isDefault: true,
    description: 'Notification for escalated support tickets',
  },

  // Notification Templates
  {
    id: 'notification-task-assigned',
    name: 'Notification - Task Assignment',
    subject: 'Task Assigned: {{subject}}',
    content: `A new task has been assigned to you.

Task Details:
- Title: {{subject}}
- Task #: {{taskNumber}}
- Priority: {{priority}}
- Due Date: {{dueDate}}
- Project: {{projectName}}

Description:
{{description}}

You can view and update this task in your dashboard: {{taskUrl}}

Best regards,
{{projectName}} Team`,
    category: 'notification',
    variables: [
      'subject',
      'taskNumber',
      'priority',
      'dueDate',
      'projectName',
      'description',
      'taskUrl',
    ],
    isDefault: true,
    description: 'Notification for task assignments',
  },
  {
    id: 'notification-status-update',
    name: 'Notification - Status Update',
    subject: 'Status Update: {{subject}}',
    content: `The status of your request has been updated.

Task: #{{taskNumber}} - {{subject}}
Previous Status: {{previousStatus}}
New Status: {{currentStatus}}
Updated By: {{updatedBy}}

{{statusComment}}

You can track progress at: {{taskUrl}}

Best regards,
{{projectName}} Team`,
    category: 'notification',
    variables: [
      'subject',
      'taskNumber',
      'previousStatus',
      'currentStatus',
      'updatedBy',
      'statusComment',
      'taskUrl',
      'projectName',
    ],
    isDefault: true,
    description: 'Notification for status changes',
  },

  // Custom Templates
  {
    id: 'custom-follow-up',
    name: 'Custom - Follow Up',
    subject: 'Following up on {{subject}}',
    content: `Hi {{customerName}},

We wanted to follow up on your recent request: {{subject}}

Ticket: #{{taskNumber}}

{{followUpMessage}}

Is there anything else we can help you with? Just reply to this email.

Best regards,
{{assigneeName}}
{{projectName}} Team`,
    category: 'custom',
    variables: [
      'customerName',
      'subject',
      'taskNumber',
      'followUpMessage',
      'assigneeName',
      'projectName',
    ],
    isDefault: false,
    description: 'Follow-up email template',
  },
  {
    id: 'custom-meeting-scheduled',
    name: 'Custom - Meeting Scheduled',
    subject: 'Meeting Scheduled - {{subject}}',
    content: `Hi {{customerName}},

We've scheduled a meeting to discuss your request: {{subject}}

Meeting Details:
- Date: {{meetingDate}}
- Time: {{meetingTime}}
- Duration: {{meetingDuration}}
- Location/Link: {{meetingLink}}

Agenda:
{{meetingAgenda}}

If you need to reschedule, please reply to this email at least 24 hours in advance.

Looking forward to speaking with you!

Best regards,
{{assigneeName}}
{{projectName}} Team`,
    category: 'custom',
    variables: [
      'customerName',
      'subject',
      'meetingDate',
      'meetingTime',
      'meetingDuration',
      'meetingLink',
      'meetingAgenda',
      'assigneeName',
      'projectName',
    ],
    isDefault: false,
    description: 'Meeting scheduling template',
  },
  {
    id: 'custom-feedback-request',
    name: 'Custom - Feedback Request',
    subject: 'How was your experience? - {{subject}}',
    content: `Hi {{customerName}},

We recently helped you with: {{subject}} (Ticket #{{taskNumber}})

We'd love to hear about your experience! Your feedback helps us improve our service.

Rate your experience:
⭐⭐⭐⭐⭐ Excellent
⭐⭐⭐⭐ Good
⭐⭐⭐ Average
⭐⭐ Below Average
⭐ Poor

What did we do well?
{{positivePoints}}

What could we improve?
{{improvementAreas}}

Simply reply to this email with your rating and comments.

Thank you for choosing {{projectName}}!

Best regards,
{{assigneeName}}
{{projectName}} Team`,
    category: 'custom',
    variables: [
      'customerName',
      'subject',
      'taskNumber',
      'positivePoints',
      'improvementAreas',
      'assigneeName',
      'projectName',
    ],
    isDefault: false,
    description: 'Customer feedback request template',
  },
];

export const TEMPLATE_CATEGORIES = [
  {
    value: 'auto-reply',
    label: 'Auto Reply',
    description: 'Automated responses to incoming emails',
  },
  { value: 'welcome', label: 'Welcome', description: 'Welcome messages for new customers' },
  { value: 'support', label: 'Support', description: 'Customer support communications' },
  { value: 'notification', label: 'Notification', description: 'Status updates and notifications' },
  { value: 'custom', label: 'Custom', description: 'Custom templates for specific needs' },
];

export const COMMON_VARIABLES = [
  { name: 'subject', description: 'Original email subject' },
  { name: 'taskNumber', description: 'Generated task number' },
  { name: 'projectName', description: 'Name of the project' },
  { name: 'customerName', description: 'Customer name from email' },
  { name: 'assigneeName', description: 'Name of assigned team member' },
  { name: 'supportEmail', description: 'Support email address' },
  { name: 'websiteUrl', description: 'Company website URL' },
  { name: 'taskUrl', description: 'Direct link to the task' },
  { name: 'priority', description: 'Task priority level' },
  { name: 'dueDate', description: 'Task due date' },
  { name: 'description', description: 'Task description' },
  { name: 'currentStatus', description: 'Current task status' },
  { name: 'previousStatus', description: 'Previous task status' },
  { name: 'updatedBy', description: 'Who updated the status' },
  { name: 'statusComment', description: 'Comment about status change' },
  { name: 'resolution', description: 'How the issue was resolved' },
  { name: 'escalatedBy', description: 'Who escalated the ticket' },
  { name: 'escalationReason', description: 'Reason for escalation' },
  { name: 'escalationSla', description: 'SLA for escalated tickets' },
  { name: 'timezone', description: 'Business timezone' },
  { name: 'emergencyPhone', description: 'Emergency contact number' },
  { name: 'additionalInfoNeeded', description: 'List of needed information' },
  { name: 'followUpMessage', description: 'Custom follow-up message' },
  { name: 'meetingDate', description: 'Scheduled meeting date' },
  { name: 'meetingTime', description: 'Scheduled meeting time' },
  { name: 'meetingDuration', description: 'Meeting duration' },
  { name: 'meetingLink', description: 'Meeting link or location' },
  { name: 'meetingAgenda', description: 'Meeting agenda' },
  { name: 'positivePoints', description: 'What went well' },
  { name: 'improvementAreas', description: 'Areas for improvement' },
];
