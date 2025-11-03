// src/components/inbox/constants/emailProviders.ts

import { EmailProvider } from "@/types/inbox";

export const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: "gmail",
    name: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    requiresAppPassword: true,
    setupInstructions:
      "You need to enable 2-factor authentication and create an app-specific password.",
  },
  {
    id: "outlook",
    name: "Outlook/Office 365",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp-mail.outlook.com",
    smtpPort: 587,
    requiresAppPassword: false,
    setupInstructions: "Use your regular email password.",
  },
  {
    id: "custom",
    name: "Custom Email Provider",
    imapHost: "",
    imapPort: 993,
    smtpHost: "",
    smtpPort: 587,
    requiresAppPassword: false,
    setupInstructions: "Enter your email provider's IMAP and SMTP settings.",
  },
];
