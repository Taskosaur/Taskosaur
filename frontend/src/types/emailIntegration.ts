// src/components/inbox/types/emailIntegration.types.ts

export interface InboxFormData {
  name: string;
  description: string;
  emailAddress: string;
  emailSignature: string;
  autoCreateTask: boolean;
  autoReplyEnabled: boolean;
  autoReplyTemplate: string;
  defaultTaskType: "TASK" | "BUG" | "EPIC" | "STORY" | "SUBTASK";
  defaultPriority: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  defaultStatusId: string;
  defaultAssigneeId: string;
  syncInterval: number;
}

export interface EmailSetupData {
  emailAddress: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  imapUseSsl: boolean;
  imapTlsRejectUnauth?: boolean;
  imapTlsMinVersion?: string;
  imapServername?: string;
  imapFolder: string;
  smtpHost: string;
  smtpPort: number;
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

export type SetupStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface StepProps {
  onNext: () => void;
  onBack: () => void;
  projectId: string;
}
