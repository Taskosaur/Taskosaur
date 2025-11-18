import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HiArrowRight,
  HiArrowLeft,
  HiCog,
  HiExclamationCircle,
  HiChevronDown,
  HiChevronUp,
} from "react-icons/hi2";
import { EMAIL_PROVIDERS } from "@/utils/data/emailProviders";
import ActionButton from "@/components/common/ActionButton";
import { EmailSetupData, EmailProvider } from "@/types/emailIntegration";

interface ProviderSelectionStepProps {
  onSubmit: (data: EmailSetupData) => void;
  onBack?: () => void;
  hasInbox: boolean;
  setupLoading?: boolean;
  isReconfiguring?: boolean;
  existingEmailData?: EmailSetupData | null;
}

export default function ProviderSelectionStep({
  onSubmit,
  onBack,
  hasInbox,
  setupLoading = false,
  isReconfiguring = false,
  existingEmailData = null,
}: ProviderSelectionStepProps) {
  const [step, setStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [emailData, setEmailData] = useState<EmailSetupData>({
    emailAddress: "",
    displayName: "",
    imapHost: "",
    imapPort: 993,
    imapUsername: "",
    imapPassword: "",
    imapUseSsl: true,
    imapTlsRejectUnauth: true,
    imapTlsMinVersion: "TLSv1.2",
    imapServername: "",
    imapFolder: "INBOX",
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    smtpTlsRejectUnauth: true,
    smtpTlsMinVersion: "TLSv1.2",
    smtpServername: "",
    smtpRequireTls: false,
  });
  useEffect(() => {
    if (existingEmailData && isReconfiguring) {
      setEmailData(existingEmailData);

      const matchingProvider = EMAIL_PROVIDERS.find(
        (p) =>
          p.imapHost === existingEmailData.imapHost && p.smtpHost === existingEmailData.smtpHost
      );

      if (matchingProvider) {
        setSelectedProvider(matchingProvider);
      } else {
        const customProvider = EMAIL_PROVIDERS.find((p) => p.id === "custom");
        if (customProvider) {
          setSelectedProvider(customProvider);
        }
      }
    }
  }, [existingEmailData, isReconfiguring]);
  const handleProviderSelect = (providerId: string) => {
    const provider = EMAIL_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;

    setSelectedProvider(provider);
    setEmailData((prev) => ({
      ...prev,
      imapHost: provider.imapHost,
      imapPort: provider.imapPort,
      smtpHost: provider.smtpHost,
      smtpPort: provider.smtpPort,
    }));
  };

  const handleContinue = () => {
    if (!isStep1Valid()) return;

    if (!emailData.imapUsername) {
      setEmailData((prev) => ({ ...prev, imapUsername: prev.emailAddress }));
    }
    if (!emailData.smtpUsername) {
      setEmailData((prev) => ({ ...prev, smtpUsername: prev.emailAddress }));
    }

    setStep(2);
  };

  const handleTestConnection = () => {
    const completeData = {
      ...emailData,
      imapUsername: emailData.imapUsername || emailData.emailAddress,
      smtpUsername: emailData.smtpUsername || emailData.emailAddress,
    };
    onSubmit(completeData);
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    } else if (onBack) {
      if (isReconfiguring) {
        onBack();
      } else {
        onBack();
      }
    }
  };

  const isStep1Valid = () => {
    if (!emailData.emailAddress || !emailData.displayName || !selectedProvider) {
      return false;
    }

    if (selectedProvider.id !== "custom") {
      return !!emailData.imapPassword;
    }

    return !!(
      emailData.imapHost &&
      emailData.imapPort &&
      emailData.imapUsername &&
      emailData.imapPassword &&
      emailData.smtpHost &&
      emailData.smtpPort &&
      emailData.smtpUsername &&
      emailData.smtpPassword
    );
  };

  // Render Step 1: Provider Selection with Credentials
  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        {selectedProvider && (
          <Badge
            className="bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 px-3 py-1"
            variant="secondary"
          >
            {selectedProvider.name}
          </Badge>
        )}
      </div>

      {/* Email Address, Display Name, and Provider - First Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="pb-2 text-sm font-medium" htmlFor="emailAddress">
            Email Address <span className="text-red-500">*</span>
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
            required
            className="h-10"
          />
        </div>

        <div>
          <Label className="pb-2 text-sm font-medium" htmlFor="displayName">
            Display Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="displayName"
            type="text"
            value={emailData.displayName}
            onChange={(e) => setEmailData((prev) => ({ ...prev, displayName: e.target.value }))}
            placeholder="Support Team"
            required
            className="h-10"
          />
        </div>
      </div>

      {/* Provider Selection - Second Row */}
      <div>
        <Label className="pb-2 text-sm font-medium" htmlFor="provider">
          Provider <span className="text-red-500">*</span>
        </Label>
        <Select value={selectedProvider?.id || ""} onValueChange={handleProviderSelect}>
          <SelectTrigger className="w-full h-10 bg-[var(--background)] border-[var(--border)]">
            <SelectValue placeholder="Select provider" className="bg-[var(--background)]" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--background)] border-[var(--border)]">
            {EMAIL_PROVIDERS.map((provider) => (
              <SelectItem key={provider.id} value={provider.id} className="hover:bg-[var(--muted)]">
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conditional Fields Based on Provider Selection - Below Provider */}
      {selectedProvider && (
        <>
          {/* Provider-specific alert */}
          {selectedProvider.requiresAppPassword && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <HiExclamationCircle /> {selectedProvider.setupInstructions}
            </p>
          )}

          {/* For Gmail and Outlook - Show only Password field */}
          {selectedProvider.id !== "custom" && (
            <div>
              <Label className="pb-2 text-sm font-medium" htmlFor="password">
                {selectedProvider.requiresAppPassword ? (
                  <>
                    App Password <span className="text-red-500">*</span>
                  </>
                ) : (
                  <>
                    Password <span className="text-red-500">*</span>
                  </>
                )}
              </Label>
              <Input
                id="password"
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
                className="h-10"
              />
            </div>
          )}

          {/* For Custom Provider - Show Host, Port, Username, Password */}
          {selectedProvider.id === "custom" && (
            <div className="space-y-6">
              {/* IMAP Configuration */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
                  IMAP Configuration (Incoming)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="pb-2 text-sm font-medium" htmlFor="imapHost">
                      IMAP Host <span className="text-red-500">*</span>
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
                      className="h-10"
                    />
                  </div>

                  <div>
                    <Label className="pb-2 text-sm font-medium" htmlFor="imapPort">
                      IMAP Port <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="imapPort"
                      type="number"
                      value={emailData.imapPort}
                      onChange={(e) =>
                        setEmailData((prev) => ({
                          ...prev,
                          imapPort: parseInt(e.target.value) || 993,
                        }))
                      }
                      placeholder="993"
                      className="h-10"
                    />
                  </div>

                  <div>
                    <Label className="pb-2 text-sm font-medium" htmlFor="imapTlsMinVersion">
                      Minimum TLS Version
                    </Label>
                    <Select
                      value={emailData.imapTlsMinVersion || "TLSv1.2"}
                      onValueChange={(value) =>
                        setEmailData((prev) => ({
                          ...prev,
                          imapTlsMinVersion: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full h-10 bg-[var(--background)] border-[var(--border)] transition-colors">
                        <SelectValue placeholder="Select TLS version" />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--background)] border-[var(--border)]">
                        <SelectItem value="TLSv1" className="hover:bg-[var(--muted)]">
                          TLS v1.0
                        </SelectItem>
                        <SelectItem value="TLSv1.1" className="hover:bg-[var(--muted)]">
                          TLS v1.1
                        </SelectItem>
                        <SelectItem value="TLSv1.2" className="hover:bg-[var(--muted)]">
                          TLS v1.2
                        </SelectItem>
                        <SelectItem value="TLSv1.3" className="hover:bg-[var(--muted)]">
                          TLS v1.3
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="pb-2 text-sm font-medium" htmlFor="imapUsername">
                    IMAP Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="imapUsername"
                    value={emailData.imapUsername}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        imapUsername: e.target.value,
                      }))
                    }
                    placeholder="username@example.com"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label className="pb-2 text-sm font-medium" htmlFor="imapPassword">
                    IMAP Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="imapPassword"
                    type="password"
                    value={emailData.imapPassword}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        imapPassword: e.target.value,
                      }))
                    }
                    placeholder="Your IMAP password"
                    className="h-10"
                  />
                </div>

                {/* IMAP Security Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="imapUseSsl"
                      checked={emailData.imapUseSsl}
                      onCheckedChange={(checked) =>
                        setEmailData((prev) => ({
                          ...prev,
                          imapUseSsl: checked as boolean,
                        }))
                      }
                    />
                    <Label htmlFor="imapUseSsl" className="text-sm font-normal cursor-pointer">
                      Use SSL/TLS
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="imapTlsRejectUnauth"
                      checked={emailData.imapTlsRejectUnauth}
                      onCheckedChange={(checked) =>
                        setEmailData((prev) => ({
                          ...prev,
                          imapTlsRejectUnauth: checked as boolean,
                        }))
                      }
                    />
                    <Label
                      htmlFor="imapTlsRejectUnauth"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Reject unauthorized certificates
                    </Label>
                  </div>
                </div>

                <div>
                  <Label className="pb-2 text-sm font-medium" htmlFor="imapServername">
                    SNI Hostname (Optional)
                  </Label>
                  <Input
                    id="imapServername"
                    value={emailData.imapServername}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        imapServername: e.target.value,
                      }))
                    }
                    placeholder="Leave empty to use IMAP host"
                    className="h-10"
                  />
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Required for TLS validation when connecting via IP address (Gmail, Office 365)
                  </p>
                </div>
              </div>

              {/* SMTP Configuration */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
                  SMTP Configuration (Outgoing)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="pb-2 text-sm font-medium" htmlFor="smtpHost">
                      SMTP Host <span className="text-red-500">*</span>
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
                      className="h-10"
                    />
                  </div>

                  <div>
                    <Label className="pb-2 text-sm font-medium" htmlFor="smtpPort">
                      SMTP Port <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="smtpPort"
                      type="number"
                      value={emailData.smtpPort}
                      onChange={(e) =>
                        setEmailData((prev) => ({
                          ...prev,
                          smtpPort: parseInt(e.target.value) || 587,
                        }))
                      }
                      placeholder="587"
                      className="h-10"
                    />
                  </div>

                  <div>
                    <Label className="pb-2 text-sm font-medium" htmlFor="smtpTlsMinVersion">
                      Minimum TLS Version
                    </Label>
                    <Select
                      value={emailData.smtpTlsMinVersion || "TLSv1.2"}
                      onValueChange={(value) =>
                        setEmailData((prev) => ({
                          ...prev,
                          smtpTlsMinVersion: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full h-10 bg-[var(--background)] border-[var(--border)] transition-colors">
                        <SelectValue placeholder="Select TLS version" />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--background)] border-[var(--border)]">
                        <SelectItem value="TLSv1" className="hover:bg-[var(--muted)]">
                          TLS v1.0
                        </SelectItem>
                        <SelectItem value="TLSv1.1" className="hover:bg-[var(--muted)]">
                          TLS v1.1
                        </SelectItem>
                        <SelectItem value="TLSv1.2" className="hover:bg-[var(--muted)]">
                          TLS v1.2
                        </SelectItem>
                        <SelectItem value="TLSv1.3" className="hover:bg-[var(--muted)]">
                          TLS v1.3
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="pb-2 text-sm font-medium" htmlFor="smtpUsername">
                    SMTP Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtpUsername"
                    value={emailData.smtpUsername}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        smtpUsername: e.target.value,
                      }))
                    }
                    placeholder="username@example.com"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label className="pb-2 text-sm font-medium" htmlFor="smtpPassword">
                    SMTP Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={emailData.smtpPassword}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        smtpPassword: e.target.value,
                      }))
                    }
                    placeholder="Your SMTP password"
                    className="h-10"
                  />
                </div>

                {/* SMTP Security Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="smtpTlsRejectUnauth"
                      checked={emailData.smtpTlsRejectUnauth}
                      onCheckedChange={(checked) =>
                        setEmailData((prev) => ({
                          ...prev,
                          smtpTlsRejectUnauth: checked as boolean,
                        }))
                      }
                    />
                    <Label
                      htmlFor="smtpTlsRejectUnauth"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Reject unauthorized certificates
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="smtpRequireTls"
                      checked={emailData.smtpRequireTls}
                      onCheckedChange={(checked) =>
                        setEmailData((prev) => ({
                          ...prev,
                          smtpRequireTls: checked as boolean,
                        }))
                      }
                    />
                    <Label
                      htmlFor="smtpRequireTls"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Force STARTTLS (recommended)
                    </Label>
                  </div>
                </div>

                <div>
                  <Label className="pb-2 text-sm font-medium" htmlFor="smtpServername">
                    SNI Hostname (Optional)
                  </Label>
                  <Input
                    id="smtpServername"
                    value={emailData.smtpServername}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        smtpServername: e.target.value,
                      }))
                    }
                    placeholder="Leave empty to use SMTP host"
                    className="h-10"
                  />
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Required for TLS validation when connecting via IP address (Gmail, Office 365)
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 pt-4 justify-end">
        {selectedProvider && (
          <ActionButton primary onClick={handleContinue} disabled={!isStep1Valid()}>
            Continue
          </ActionButton>
        )}

        <ActionButton secondary onClick={handlePrevStep}>
          Back
        </ActionButton>
      </div>
    </div>
  );

  // Render Step 2: Connection Test
  const renderStep2 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h3 className="text-lg font-semibold mb-2">Test Email Connection</h3>
        <p className="text-sm text-[var(--muted-foreground)]/60">
          Verify your email configuration before completing the setup
        </p>
      </div>

      <div className="bg-[var(--muted)]/30 p-6 rounded-xl border border-[var(--border)]">
        <h4 className="text-base font-semibold mb-4 flex items-center">
          <HiCog className="w-5 h-5 mr-2 text-[var(--primary)]" />
          Configuration Summary
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start space-x-2">
            <span className="font-medium text-[var(--foreground)] min-w-[80px]">Email:</span>
            <span className="text-[var(--muted-foreground)]">{emailData.emailAddress}</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium text-[var(--foreground)] min-w-[80px]">Provider:</span>
            <span className="text-[var(--muted-foreground)]">{selectedProvider?.name}</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium text-[var(--foreground)] min-w-[80px]">IMAP:</span>
            <span className="text-[var(--muted-foreground)]">
              {emailData.imapHost}:{emailData.imapPort}
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium text-[var(--foreground)] min-w-[80px]">SMTP:</span>
            <span className="text-[var(--muted-foreground)]">
              {emailData.smtpHost}:{emailData.smtpPort}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-blue-800 flex items-center gap-2">
        <HiExclamationCircle /> We'll test both incoming (IMAP) and outgoing (SMTP) connections to
        ensure everything works properly.
      </p>

      <div className="flex justify-end gap-2">
        <ActionButton onClick={handleTestConnection} disabled={setupLoading} primary>
          {setupLoading ? <>Testing Connection...</> : <>Test Connection</>}
        </ActionButton>
        <ActionButton onClick={handlePrevStep} disabled={setupLoading} secondary>
          Back
        </ActionButton>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
    </div>
  );
}
