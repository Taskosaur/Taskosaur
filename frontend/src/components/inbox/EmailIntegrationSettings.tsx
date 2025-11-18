import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HiEnvelope } from "react-icons/hi2";
import { inboxApi } from "@/utils/api/inboxApi";
import { useInbox } from "@/contexts/inbox-context";
import { useProjectContext } from "@/contexts/project-context";
import { useDebounce } from "@/hooks/useDebounce";
import { InboxFormData, EmailSetupData } from "@/types/emailIntegration";
import Stepper from "../shared/Stepper";
import CompletedConfigView from "../shared/CompletedConfigView";
import InboxConfigurationStep from "./setup-steps/InboxConfigurationStep";
import ProviderSelectionStep from "./setup-steps/ProviderSelectionStep";
import SuccessStep from "./setup-steps/SuccessStep";

interface EmailIntegrationSettingsProps {
  projectId: string;
}

export default function EmailIntegrationSettings({ projectId }: EmailIntegrationSettingsProps) {
  const {
    currentInbox,
    isSyncing,
    createInbox,
    getInbox,
    updateInbox,
    triggerSync,
    setCurrentInbox,
    clearError,
  } = useInbox();

  const projectContext = useProjectContext();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const debouncedAssigneeSearchTerm = useDebounce(assigneeSearchTerm, 500);
  const [setupLoading, setSetupLoading] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [isReconfiguring, setIsReconfiguring] = useState(false);
  const [formData, setFormData] = useState<InboxFormData>({
    name: "",
    description: "",
    emailAddress: "",
    emailSignature: "",
    autoCreateTask: true,
    autoReplyEnabled: false,
    autoReplyTemplate: "",
    defaultTaskType: "TASK",
    defaultPriority: "MEDIUM",
    defaultStatusId: "",
    defaultAssigneeId: "",
    syncInterval: 5,
  });
  const [existingEmailData, setExistingEmailData] = useState<EmailSetupData | null>(null);
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadInboxData(), loadProjectData("")]);
    };
    loadData();
  }, [projectId]);

  useEffect(() => {
    if (currentInbox) {
      const newFormData: InboxFormData = {
        name: currentInbox.name || "",
        description: currentInbox.description || "",
        emailAddress: currentInbox.emailAddress || "",
        emailSignature: currentInbox.emailSignature || "",
        autoCreateTask: currentInbox.autoCreateTask ?? true,
        autoReplyEnabled: currentInbox.autoReplyEnabled ?? false,
        autoReplyTemplate: currentInbox.autoReplyTemplate || "",
        defaultTaskType: currentInbox.defaultTaskType || "TASK",
        defaultPriority: currentInbox.defaultPriority || "MEDIUM",
        defaultStatusId: currentInbox.defaultStatusId || "",
        defaultAssigneeId: currentInbox.defaultAssigneeId || "",
        syncInterval: currentInbox.syncInterval || 5,
      };
      setFormData(newFormData);
      setHasUnsavedChanges(false);

      if (!currentInbox.emailAccount) {
        setCurrentStep(2);
      } else {
        setCurrentStep(4);
      }
    } else {
      setCurrentStep(1);
    }
  }, [currentInbox]);

  useEffect(() => {
    return () => clearError();
  }, [projectId, clearError]);

  useEffect(() => {
    loadProjectData(debouncedAssigneeSearchTerm);
  }, [debouncedAssigneeSearchTerm]);

  const loadInboxData = async () => {
    setLoadingInbox(true);
    try {
      await getInbox(projectId);
    } catch (error: any) {
      if (error.response?.status === 404) {
        setCurrentInbox(null);
      } else {
        toast.error("Failed to load email integration settings");
      }
    } finally {
      setLoadingInbox(false);
    }
  };

  const getCombinedUsers = useCallback(() => {
    if (!formData.defaultAssigneeId) {
      return availableUsers;
    }

    const selectedUserInList = availableUsers.find(
      (user) => user.user.id === formData.defaultAssigneeId
    );

    if (selectedUserInList) {
      return availableUsers;
    }

    const selectedUser = allUsers.find((user) => user.user.id === formData.defaultAssigneeId);

    if (selectedUser) {
      return [selectedUser, ...availableUsers];
    }

    return availableUsers;
  }, [availableUsers, allUsers, formData.defaultAssigneeId]);

  const loadProjectData = useCallback(
    async (search: string = "") => {
      try {
        const [statuses, users]: any = await Promise.all([
          projectContext.getTaskStatusByProject(projectId),
          projectContext.getProjectMembers?.(projectId, search) || Promise.resolve([]),
        ]);

        setAvailableStatuses(statuses || []);
        setAvailableUsers(users || []);

        if (!search) {
          setAllUsers(users || []);
        }
      } catch (error) {
        console.error("Failed to load project data:", error);
        setAvailableStatuses([]);
        setAvailableUsers([]);
        if (!search) {
          setAllUsers([]);
        }
      }
    },
    [projectId, projectContext]
  );

  const validateForm = (data: InboxFormData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!data.name.trim()) {
      errors.name = "Inbox name is required";
    } else if (data.name.length > 100) {
      errors.name = "Name must be less than 100 characters";
    }

    if (data.emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress)) {
      errors.emailAddress = "Please enter a valid email address";
    }

    if (!data.defaultStatusId) {
      errors.defaultStatusId = "Please select a default status";
    }

    if (data.autoReplyEnabled && !data.autoReplyTemplate.trim()) {
      errors.autoReplyTemplate = "Auto-reply message is required when auto-reply is enabled";
    }

    return errors;
  };

  const handleFieldChange = (field: keyof InboxFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);

    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleInboxConfigSubmit = async () => {
    const errors = validateForm(formData);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsSaving(true);
      const inboxData = {
        ...formData,
        defaultStatusId: formData.defaultStatusId || availableStatuses[0]?.id || "",
        syncInterval: formData.syncInterval || 5,
      };

      if (currentInbox) {
        await updateInbox(projectId, inboxData);
        toast.success("Inbox updated successfully");
        setHasUnsavedChanges(false);
      } else {
        await createInbox(projectId, inboxData);
        toast.success("Inbox created successfully");
        setCurrentStep(2);
      }
    } catch (error: any) {
      toast.error(currentInbox ? "Failed to update inbox" : "Failed to create inbox");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailSetupSubmit = async (emailSetupData: EmailSetupData) => {
    setSetupLoading(true);
    try {
      const completeEmailData = {
        ...emailSetupData,
        imapUsername: emailSetupData.imapUsername || emailSetupData.emailAddress,
        smtpUsername: emailSetupData.smtpUsername || emailSetupData.emailAddress,
      };

      // Step 1: Save email account to database
      const accountResponse = await inboxApi.setupEmailAccount(projectId, completeEmailData);

      if (!accountResponse?.id) {
        throw new Error("Failed to create email account");
      }

      // Step 2: Test the email connection
      toast.loading("Testing email connection...", { id: "test-connection" });

      const testResult = await inboxApi.testEmailConnection(projectId, accountResponse.id);

      toast.dismiss("test-connection");

      if (testResult.success) {
        toast.success("Email connection test passed! ✓");
        setCurrentStep(3);
      } else {
        toast.error(`Connection test failed: ${testResult.message}`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to setup email account";
      toast.error(errorMessage);
      throw error;
    } finally {
      setSetupLoading(false);
    }
  };

  const finishSetup = () => {
    loadInboxData();
    toast.success("Email integration is now active!");
    setCurrentStep(4);
  };

  const handleTriggerSync = async () => {
    try {
      await triggerSync(projectId);
      toast.success("Email sync triggered");

      setTimeout(() => {
        loadInboxData();
      }, 2000);
    } catch (error: any) {
      toast.error("Failed to trigger sync");
    }
  };

  const handleResetChanges = () => {
    if (currentInbox) {
      setFormData({
        name: currentInbox.name || "",
        description: currentInbox.description || "",
        emailAddress: currentInbox.emailAddress || "",
        emailSignature: currentInbox.emailSignature || "",
        autoCreateTask: currentInbox.autoCreateTask ?? true,
        autoReplyEnabled: currentInbox.autoReplyEnabled ?? false,
        autoReplyTemplate: currentInbox.autoReplyTemplate || "",
        defaultTaskType: currentInbox.defaultTaskType || "TASK",
        defaultPriority: currentInbox.defaultPriority || "MEDIUM",
        defaultStatusId: currentInbox.defaultStatusId || "",
        defaultAssigneeId: currentInbox.defaultAssigneeId || "",
        syncInterval: currentInbox.syncInterval || 5,
      });
      setHasUnsavedChanges(false);
      setValidationErrors({});
    }
  };

  const handleReconfigure = () => {
    if (currentInbox?.emailAccount) {
      // Preserve existing email account data
      const emailData: EmailSetupData = {
        emailAddress: currentInbox.emailAccount.emailAddress || "",
        displayName: currentInbox.emailAccount.displayName || "",
        imapHost: currentInbox.emailAccount.imapHost || "",
        imapPort: currentInbox.emailAccount.imapPort || 993,
        imapUsername: currentInbox.emailAccount.imapUsername || "",
        imapPassword: "", // Don't populate password for security reasons
        imapUseSsl: currentInbox.emailAccount.imapUseSsl ?? true,
        imapTlsRejectUnauth: currentInbox.emailAccount.imapTlsRejectUnauth ?? true,
        imapTlsMinVersion: currentInbox.emailAccount.imapTlsMinVersion || "TLSv1.2",
        imapServername: currentInbox.emailAccount.imapServername || "",
        imapFolder: currentInbox.emailAccount.imapFolder || "INBOX",
        smtpHost: currentInbox.emailAccount.smtpHost || "",
        smtpPort: currentInbox.emailAccount.smtpPort || 587,
        smtpUsername: currentInbox.emailAccount.smtpUsername || "",
        smtpPassword: "", // Don't populate password for security reasons
        smtpTlsRejectUnauth: currentInbox.emailAccount.smtpTlsRejectUnauth ?? true,
        smtpTlsMinVersion: currentInbox.emailAccount.smtpTlsMinVersion || "TLSv1.2",
        smtpServername: currentInbox.emailAccount.smtpServername || "",
        smtpRequireTls: currentInbox.emailAccount.smtpRequireTls ?? false,
      };
      setExistingEmailData(emailData);
    }
    setIsReconfiguring(true);
    setCurrentStep(2);
  };

  if (currentStep === 4 && currentInbox?.emailAccount) {
    return (
      <CompletedConfigView
        currentInbox={currentInbox}
        formData={formData}
        validationErrors={validationErrors}
        availableStatuses={availableStatuses}
        availableUsers={getCombinedUsers()}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isSyncing={isSyncing}
        onFieldChange={handleFieldChange}
        onSave={handleInboxConfigSubmit}
        onReset={handleResetChanges}
        onTriggerSync={handleTriggerSync}
        onReconfigure={handleReconfigure}
        onAssigneeSearch={setAssigneeSearchTerm}
      />
    );
  }

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex w-full items-start">
          <CardTitle className="flex items-start gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <HiEnvelope className="w-5 h-5 text-[var(--primary)]" />
                <span className="text-md font-semibold">Email Integration Setup</span>
              </div>
              <p className="text-sm font-normal text-[var(--muted-foreground)]/60 mt-2">
                Configure your email account to sync with tasks
              </p>
            </div>
          </CardTitle>
        </div>

        {!loadingInbox && <Stepper currentStep={currentStep} hasInbox={!!currentInbox} />}
      </CardHeader>

      <CardContent className="">
        {/* Step 1: Inbox Configuration */}
        {currentStep === 1 && (
          <InboxConfigurationStep
            formData={formData}
            validationErrors={validationErrors}
            availableStatuses={availableStatuses}
            availableUsers={getCombinedUsers()}
            isSaving={isSaving}
            onFieldChange={handleFieldChange}
            onSubmit={handleInboxConfigSubmit}
            onAssigneeSearch={setAssigneeSearchTerm}
          />
        )}

        {/* Step 2: Email Setup (Provider, Credentials, Connection Test) */}
        {currentStep === 2 && (
          <ProviderSelectionStep
            onSubmit={handleEmailSetupSubmit}
            onBack={() => {
              if (isReconfiguring) {
                setCurrentStep(4);
                setIsReconfiguring(false);
                setExistingEmailData(null);
              } else {
                setCurrentStep(1);
              }
            }}
            hasInbox={!!currentInbox}
            setupLoading={setupLoading}
            isReconfiguring={isReconfiguring}
            existingEmailData={existingEmailData}
          />
        )}

        {/* Step 3: Success */}
        {currentStep === 3 && <SuccessStep onFinish={finishSetup} />}
      </CardContent>
    </Card>
  );
}
