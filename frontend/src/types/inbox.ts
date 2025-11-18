export interface ProjectInbox {
  id: string;
  projectId: string;
  enabled: boolean;
  name: string;
  description?: string;
  emailAddress?: string;
  emailSignature?: string;
  autoReplyEnabled: boolean;
  autoReplyTemplate?: string;
  autoCreateTask: boolean;
  defaultTaskType: "TASK" | "BUG" | "EPIC" | "STORY" | "SUBTASK";
  defaultPriority: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  defaultStatusId: string;
  defaultAssigneeId?: string;
  createdAt: string;
  updatedAt: string;
  emailAccount?: EmailAccount;
  syncInterval: number;
}

export interface EmailAccount {
  id: string;
  projectInboxId: string;
  emailAddress: string;
  displayName?: string;
  imapHost?: string;
  imapPort?: number;
  imapUsername?: string;
  imapUseSsl: boolean;
  imapTlsRejectUnauth?: boolean;
  imapTlsMinVersion?: string;
  imapServername?: string;
  imapFolder: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpTlsRejectUnauth?: boolean;
  smtpTlsMinVersion?: string;
  smtpServername?: string;
  smtpRequireTls?: boolean;
  syncEnabled: boolean;
  lastSyncAt?: string;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboxMessage {
  id: string;
  projectInboxId: string;
  messageId: string;
  threadId: string;
  inReplyTo?: string;
  references: string[];
  subject: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  ccEmails: string[];
  bodyText?: string;
  bodyHtml?: string;
  snippet?: string;
  headers: any;
  hasAttachments: boolean;
  status: MessageStatus;
  isSpam: boolean;
  taskId?: string;
  convertedAt?: string;
  convertedBy?: string;
  emailDate: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  task?: {
    id: string;
    title: string;
    taskNumber: number;
    status: {
      name: string;
      color: string;
    };
  };
}

export interface InboxRule {
  id: string;
  projectInboxId: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  conditions: any;
  actions: any;
  stopOnMatch: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = "PENDING" | "PROCESSING" | "CONVERTED" | "IGNORED" | "FAILED";

export interface CreateInboxDto {
  name: string;
  description?: string;
  emailAddress?: string;
  emailSignature?: string;
  autoReplyEnabled?: boolean;
  autoReplyTemplate?: string;
  autoCreateTask?: boolean;
  defaultTaskType?: "TASK" | "BUG" | "EPIC" | "STORY" | "SUBTASK";
  defaultPriority?: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  defaultStatusId?: string;
  defaultAssigneeId?: string;
}

export interface SetupEmailDto {
  emailAddress: string;
  displayName?: string;
  imapHost: string;
  imapPort?: number;
  imapUsername: string;
  imapPassword: string;
  imapUseSsl?: boolean;
  imapTlsRejectUnauth?: boolean;
  imapTlsMinVersion?: string;
  imapServername?: string;
  imapFolder?: string;
  smtpHost: string;
  smtpPort?: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpTlsRejectUnauth?: boolean;
  smtpTlsMinVersion?: string;
  smtpServername?: string;
  smtpRequireTls?: boolean;
}

export interface EmailProvider {
  id: string;
  name: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  requiresAppPassword: boolean;
  setupInstructions: string;
}
