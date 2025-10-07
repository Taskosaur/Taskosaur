import React, { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  HiEnvelope,
  HiCheckCircle,
  HiExclamationCircle,
  HiArrowRight,
  HiArrowLeft,
  HiCog,
} from "react-icons/hi2";
import { inboxApi } from "@/utils/api/inboxApi";
import { SetupEmailDto, EmailProvider } from "@/types/inbox";

const EMAIL_PROVIDERS: EmailProvider[] = [
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

interface EmailSetupWizardProps {
  projectId: string;
  onComplete: () => void;
  onCancel: () => void;
  stepsDisplay: boolean;
}

export default function EmailSetupWizard({
  projectId,
  onComplete,
  onCancel,
  stepsDisplay,
}: EmailSetupWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<EmailProvider | null>(null);
  const [emailData, setEmailData] = useState<SetupEmailDto>({
    emailAddress: "",
    displayName: "",
    imapHost: "",
    imapPort: 993,
    imapUsername: "",
    imapPassword: "",
    imapUseSsl: true,
    imapFolder: "INBOX",
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    smtpUseTls: true,
  });

  const handleProviderSelect = (provider: EmailProvider) => {
    setSelectedProvider(provider);
    setEmailData((prev) => ({
      ...prev,
      imapHost: provider.imapHost,
      imapPort: provider.imapPort,
      smtpHost: provider.smtpHost,
      smtpPort: provider.smtpPort,
    }));
    setStep(2);
  };

  const handleEmailCredentials = () => {
    if (
      !emailData.emailAddress ||
      !emailData.imapPassword ||
      !emailData.smtpPassword
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Auto-fill usernames if not provided
    if (!emailData.imapUsername) {
      setEmailData((prev) => ({ ...prev, imapUsername: prev.emailAddress }));
    }
    if (!emailData.smtpUsername) {
      setEmailData((prev) => ({ ...prev, smtpUsername: prev.emailAddress }));
    }

    setStep(3);
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      const result = await inboxApi.setupEmailAccount(projectId, {
        ...emailData,
        imapUsername: emailData.imapUsername || emailData.emailAddress,
        smtpUsername: emailData.smtpUsername || emailData.emailAddress,
      });

      toast.success("Email account configured successfully!");
      setStep(4);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to setup email account"
      );
    } finally {
      setLoading(false);
    }
  };

  const finishSetup = () => {
    onComplete();
    toast.success("Email integration is now active!");
  };

  return (
    <Card className=" border-[var(--border)]">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <HiEnvelope className="w-6 h-6" />
              <span>Set Up Email Integration</span>
            </div>
            <div className="text-sm font-medium">{stepsDisplay ? `${step} of 4` : `${step + 1} of 5`}</div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Provider Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Choose Your Email Provider</h3>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 items-stretch max-w-5xl">
              {EMAIL_PROVIDERS.map((provider, index) => (
                <Card
                  key={provider.id}
                  className={`cursor-pointer border-[var(--border)] rounded-2xl shadow-sm hover:shadow-md hover:scale-101 transition-transform duration-200 
                    flex flex-col justify-between min-h-[180px]
                    ${index === 2 ? "md:col-span-2 w-full md:w-[48%]" : ""}`}
                  onClick={() => handleProviderSelect(provider)}
                >
                  <CardContent className="p-6 flex flex-col justify-between h-full">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col text-left">
                        <h4 className="font-semibold text-lg text-[var(--foreground)]">
                          {provider.name}
                        </h4>
                        <p className="text-sm text-[var(--muted-foreground)] mt-1">
                          {provider.setupInstructions}
                        </p>
                      </div>

                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 flex items-center justify-center bg-[var(--accent)]/10 rounded-full hover:bg-[var(--accent)]/20 transition-colors">
                          <HiArrowRight className="w-5 h-5 text-[var(--accent)]" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                className="border-[var(--border)]"
                variant="outline"
                onClick={onCancel}
              >
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Email Credentials */}
        {step === 2 && selectedProvider && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Enter Email Credentials</h3>
              <Badge className="bg-gray-300" variant="secondary">
                {selectedProvider.name}
              </Badge>
            </div>

            {selectedProvider.requiresAppPassword && (
              <Alert
                className="mt-6 flex items-center justify-center space-x-2"
                variant="destructive"
              >
                <HiExclamationCircle className="w-6 h-6 pb-1 mr-2 flex-shrink-0 text-destructive-foreground" />
                <AlertDescription>
                  {selectedProvider.setupInstructions}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4">
              <div>
                <Label className="pb-2" htmlFor="emailAddress">
                  Email Address{" "}
                  <span className="projects-form-label-required">*</span>
                </Label>
                <Input
                  id="emailAddress"
                  type="email"
                  value={emailData.emailAddress}
                  onChange={(e) =>
                    setEmailData((prev) => ({
                      ...prev,
                      emailAddress: e.target.value,
                    }))
                  }
                  placeholder="support@company.com"
                />
              </div>

              <div>
                <Label className="pb-2" htmlFor="displayName">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  value={emailData.displayName}
                  onChange={(e) =>
                    setEmailData((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  placeholder="Support Team"
                />
              </div>

              {selectedProvider.id === "custom" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="pb-2" htmlFor="imapHost">
                        IMAP Host{" "}
                        <span className="projects-form-label-required">*</span>
                      </Label>
                      <Input
                        id="imapHost"
                        value={emailData.imapHost}
                        onChange={(e) =>
                          setEmailData((prev) => ({
                            ...prev,
                            imapHost: e.target.value,
                          }))
                        }
                        placeholder="imap.example.com"
                      />
                    </div>
                    <div>
                      <Label className="pb-2" htmlFor="imapPort">
                        IMAP Port
                      </Label>
                      <Input
                        id="imapPort"
                        type="number"
                        value={emailData.imapPort}
                        onChange={(e) =>
                          setEmailData((prev) => ({
                            ...prev,
                            imapPort: parseInt(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="pb-2" htmlFor="smtpHost">
                        SMTP Host{" "}
                        <span className="projects-form-label-required">*</span>
                      </Label>
                      <Input
                        id="smtpHost"
                        value={emailData.smtpHost}
                        onChange={(e) =>
                          setEmailData((prev) => ({
                            ...prev,
                            smtpHost: e.target.value,
                          }))
                        }
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <Label className="pb-2" htmlFor="smtpPort">
                        SMTP Port
                      </Label>
                      <Input
                        id="smtpPort"
                        type="number"
                        value={emailData.smtpPort}
                        onChange={(e) =>
                          setEmailData((prev) => ({
                            ...prev,
                            smtpPort: parseInt(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label className="pb-2" htmlFor="imapPassword">
                  {selectedProvider.requiresAppPassword ? (
                    <>
                      App Password{" "}
                      <span className="projects-form-label-required">*</span>
                    </>
                  ) : (
                    <>
                      Password{" "}
                      <span className="projects-form-label-required">*</span>
                    </>
                  )}
                </Label>
                <Input
                  id="imapPassword"
                  type="password"
                  value={emailData.imapPassword}
                  onChange={(e) =>
                    setEmailData((prev) => ({
                      ...prev,
                      imapPassword: e.target.value,
                      smtpPassword: e.target.value,
                    }))
                  }
                  placeholder={
                    selectedProvider.requiresAppPassword
                      ? "App-specific password"
                      : "Your email password"
                  }
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                className="border-[var(--border)]"
                variant="outline"
                onClick={() => setStep(1)}
              >
                <HiArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleEmailCredentials}>
                Next
                <HiArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Connection Test */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Test Email Connection</h3>

            <div className="bg-[var(--card)] p-4 rounded-lg shadow-sm">
              <h4 className="text-base font-semibold mb-3">
                Configuration Summary
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Email:</span>{" "}
                  {emailData.emailAddress}
                </div>
                <div>
                  <span className="font-medium">Provider:</span>{" "}
                  {selectedProvider?.name}
                </div>
                <div>
                  <span className="font-medium">IMAP:</span>{" "}
                  {emailData.imapHost}:{emailData.imapPort}
                </div>
                <div>
                  <span className="font-medium">SMTP:</span>{" "}
                  {emailData.smtpHost}:{emailData.smtpPort}
                </div>
              </div>
            </div>

            <Alert className="border-[var(--border)] flex items-center justify-center space-x-2">
              <HiExclamationCircle className="w-6 h-6 pb-1" />
              <AlertDescription className="m-0">
                We'll test both incoming (IMAP) and outgoing (SMTP) connections.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button
                className="border-[var(--border)]"
                variant="outline"
                onClick={() => setStep(2)}
              >
                <HiArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={testConnection} disabled={loading}>
                {loading ? (
                  <>
                    <HiCog className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    Test Connection
                    <HiArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <HiCheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h3 className="text-lg font-medium">Email Integration Active!</h3>

            <div className="bg-green-50 p-4 rounded-lg text-left">
              <h4 className="font-medium mb-2">What happens next:</h4>
              <ul className="space-y-1 text-sm text-green-700">
                <li>• Emails will be automatically converted to tasks</li>
                <li>• Task comments can be sent as email replies</li>
                <li>• Email sync runs every 5 minutes</li>
                <li>• You can manage settings in project configuration</li>
              </ul>
            </div>

            <div className="flex justify-between">
              <Button
                className="border-[var(--border)]"
                variant="outline"
                onClick={onCancel}
              >
                Close
              </Button>
              <Button
                className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium cursor-pointer rounded-lg flex items-center gap-2"
                onClick={finishSetup}
              >
                Finish Setup
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
