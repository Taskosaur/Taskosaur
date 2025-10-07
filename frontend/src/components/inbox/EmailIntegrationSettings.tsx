import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HiEnvelope,
  HiCog,
  HiCheckCircle,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { RefreshCw } from "lucide-react";
import EmailSetupWizard from "./EmailSetupWizard";
import { useInbox } from "@/contexts/inbox-context";
import { useProjectContext } from "@/contexts/project-context";
import ActionButton from "../common/ActionButton";
import Tooltip from "../common/ToolTip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDebounce } from "@/hooks/useDebounce";

interface EmailIntegrationSettingsProps {
  projectId: string;
}

interface FormData {
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

const SearchableAssigneeDropdown = ({ value, onChange, users, onSearch }) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedUser = users.find((user) => user.user.id === value);

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) {
      setLocalSearchTerm("");
      onSearch("");
    }
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);
    onSearch(value);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          className="w-full justify-between border-[var(--border)] bg-[var(--background)] text-sm font-normal"
        >
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage
                  src={selectedUser.user.avatar || "/placeholder.svg"}
                  alt={`${selectedUser.user.firstName} ${selectedUser.user.lastName}`}
                />
                <AvatarFallback className="text-xs">
                  {getInitials(
                    selectedUser.user.firstName,
                    selectedUser.user.lastName
                  )}
                </AvatarFallback>
              </Avatar>
              <span>{`${selectedUser.user.firstName} ${selectedUser.user.lastName}`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>Select default assignee</span>
            </div>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="p-0 bg-[var(--card)] border-[var(--border)] shadow-sm"
        style={{ minWidth: triggerRef.current?.offsetWidth }}
      >
        <Command>
          <CommandInput
            placeholder="Search assignees..."
            value={localSearchTerm}
            onValueChange={handleSearchChange}
            className="border-b border-[var(--border)] focus:ring-0 w-full"
          />
          <CommandList>
            <CommandEmpty>No assignees found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange("");
                  setPopoverOpen(false);
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-[var(--muted)]"
              >
                No default assignee
              </CommandItem>
              {users.map((user) => (
                <CommandItem
                  key={user.user.id}
                  value={`${user.user.firstName} ${user.user.lastName}`}
                  onSelect={() => {
                    onChange(user.user.id);
                    setPopoverOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-[var(--muted)]"
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage
                      src={user.user.avatar || "/placeholder.svg"}
                      alt={`${user.user.firstName} ${user.user.lastName}`}
                    />
                    <AvatarFallback className="text-xs">
                      {getInitials(user.user.firstName, user.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm">{`${user.user.firstName} ${user.user.lastName}`}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.user.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function EmailIntegrationSettings({
  projectId,
}: EmailIntegrationSettingsProps) {
  const {
    currentInbox,
    isLoading,
    isSyncing,
    error,
    createInbox,
    getInbox,
    updateInbox,
    triggerSync,
    setCurrentInbox,
    clearError,
  } = useInbox();

  const projectContext = useProjectContext();

  // Form state
  const [formData, setFormData] = useState<FormData>({
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

  // UI state
  const [showWizard, setShowWizard] = useState(false);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const debouncedAssigneeSearchTerm = useDebounce(assigneeSearchTerm, 500);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadInboxData(), loadProjectData("")]);
    };
    loadData();
  }, [projectId]);

  // Update form data when inbox loads
  useEffect(() => {
    if (currentInbox) {
      const newFormData = {
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
    }
  }, [currentInbox]);

  // Clear errors on unmount
  useEffect(() => {
    return () => clearError();
  }, [projectId, clearError]);

  const loadInboxData = async () => {
    try {
      await getInbox(projectId);
    } catch (error: any) {
      if (error.response?.status === 404) {
        setCurrentInbox(null);
      } else {
        toast.error("Failed to load email integration settings");
      }
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
    const selectedUser = allUsers.find(
      (user) => user.user.id === formData.defaultAssigneeId
    );

    if (selectedUser) {
      return [selectedUser, ...availableUsers];
    }

    return availableUsers;
  }, [availableUsers, allUsers, formData.defaultAssigneeId]);

  const loadProjectData = useCallback(
    async (search: string = "") => {
      try {
        const [statuses, users] = await Promise.all([
          projectContext.getTaskStatusByProject(projectId),
          projectContext.getProjectMembers?.(projectId, search) ||
            Promise.resolve([]),
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

  useEffect(() => {
    loadProjectData(debouncedAssigneeSearchTerm);
  }, [debouncedAssigneeSearchTerm]);

  const validateForm = (data: FormData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!data.name.trim()) {
      errors.name = "Inbox name is required";
    } else if (data.name.length > 100) {
      errors.name = "Name must be less than 100 characters";
    }

    if (
      data.emailAddress &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress)
    ) {
      errors.emailAddress = "Please enter a valid email address";
    }

    if (!data.defaultStatusId) {
      errors.defaultStatusId = "Please select a default status";
    }

    if (data.autoReplyEnabled && !data.autoReplyTemplate.trim()) {
      errors.autoReplyTemplate =
        "Auto-reply message is required when auto-reply is enabled";
    }

    return errors;
  };

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true); // Mark as having unsaved changes

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCreateInbox = async () => {
    const errors = validateForm(formData);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the validation errors before creating the inbox");
      return;
    }

    try {
      setIsSaving(true);
      const inboxData = {
        ...formData,
        defaultStatusId:
          formData.defaultStatusId || availableStatuses[0]?.id || "",
        syncInterval: formData.syncInterval || 5,
      };

      await createInbox(projectId, inboxData);
      setShowSetupForm(false);
      setShowWizard(true);
      setHasUnsavedChanges(false);
      toast.success("Inbox created successfully");
    } catch (error: any) {
      toast.error("Failed to create inbox");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateInbox = async () => {
    const errors = validateForm(formData);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the validation errors before updating the inbox");
      return;
    }

    try {
      setIsSaving(true);
      const inboxData = {
        ...formData,
        defaultStatusId:
          formData.defaultStatusId || availableStatuses[0]?.id || "",
        syncInterval: formData.syncInterval || 5,
      };

      await updateInbox(projectId, inboxData);
      setHasUnsavedChanges(false);
      toast.success("Inbox updated successfully");
    } catch (error: any) {
      toast.error("Failed to update inbox");
    } finally {
      setIsSaving(false);
    }
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

  if (isLoading) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showWizard) {
    return (
      <EmailSetupWizard
        projectId={projectId}
        onComplete={() => {
          setShowWizard(false);
          loadInboxData();
        }}
        stepsDisplay={!!currentInbox}
        onCancel={() => {
          setShowWizard(false);
          loadInboxData();
        }}
      />
    );
  }

  if (!currentInbox || showSetupForm) {
    return (
      <Card className="border-[var(--border)]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <HiEnvelope className="w-5 h-5" />
                <span>Email Integration Setup</span>
              </CardTitle>
              <p className="text-sm text-[var(--muted-foreground)]/60 mt-1">
                Automate task creation from emails
              </p>
            </div>
            {!showSetupForm ? (
              <ActionButton
                primary
                showPlusIcon
                onClick={() => setShowSetupForm(true)}
              >
                Set Up Email Integration
              </ActionButton>
            ) : (
              <div>1 of 5</div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!showSetupForm ? (
            <div className="text-center py-8">
              <HiEnvelope className="w-7 h-7 mx-auto text-[var(--muted-foreground)]/40 mb-4" />
              <h3 className="text-sm font-semibold">
                No Email Integration Configured
              </h3>
              <p className="text-[var(--muted-foreground)]/60 mb-6">
                Configure your email inbox to automatically convert emails to
                tasks.
              </p>
            </div>
          ) : (
            <>
              {/* Inbox Setup Form */}
              <div className="space-y-4">
                <div>
                  <Label className="pb-2" htmlFor="inboxName">
                    Inbox Name{" "}
                    <span className="projects-form-label-required">*</span>
                  </Label>
                  <Input
                    id="inboxName"
                    value={formData.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="Support Inbox"
                    className={validationErrors.name ? "border-red-500" : ""}
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="pb-2" htmlFor="description">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      handleFieldChange("description", e.target.value)
                    }
                    placeholder="Customer support email integration"
                    rows={2}
                  />
                </div>

                <div>
                  <Label className="pb-2" htmlFor="emailAddress">
                    Email Address
                  </Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={formData.emailAddress}
                    onChange={(e) =>
                      handleFieldChange("emailAddress", e.target.value)
                    }
                    placeholder="support@company.com"
                    className={
                      validationErrors.emailAddress ? "border-red-500" : ""
                    }
                  />
                  {validationErrors.emailAddress && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.emailAddress}
                    </p>
                  )}
                  <p className="text-sm text-[var(--muted-foreground)]/60 mt-1">
                    Can be configured later in email setup wizard
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="pb-2" htmlFor="defaultTaskType">
                      Default Task Type
                    </Label>
                    <Select
                      value={formData.defaultTaskType}
                      onValueChange={(value) =>
                        handleFieldChange(
                          "defaultTaskType",
                          value as FormData["defaultTaskType"]
                        )
                      }
                    >
                      <SelectTrigger className="w-full border-[var(--border)]">
                        <SelectValue placeholder="Select task type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="TASK"
                        >
                          Task
                        </SelectItem>
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="BUG"
                        >
                          Bug
                        </SelectItem>
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="EPIC"
                        >
                          Epic
                        </SelectItem>
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="STORY"
                        >
                          Story
                        </SelectItem>
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="SUBTASK"
                        >
                          Subtask
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="pb-2" htmlFor="defaultPriority">
                      Default Priority
                    </Label>
                    <Select
                      value={formData.defaultPriority}
                      onValueChange={(value) =>
                        handleFieldChange(
                          "defaultPriority",
                          value as FormData["defaultPriority"]
                        )
                      }
                    >
                      <SelectTrigger className="w-full border-[var(--border)]">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="w-full bg-[var(--card)] border-[var(--border)]">
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="LOW"
                        >
                          Low
                        </SelectItem>
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="MEDIUM"
                        >
                          Medium
                        </SelectItem>
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="HIGH"
                        >
                          High
                        </SelectItem>
                        <SelectItem
                          className="hover:bg-[var(--muted)]"
                          value="HIGHEST"
                        >
                          Highest
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="pb-2" htmlFor="defaultStatus">
                      Default Status{" "}
                      <span className="projects-form-label-required">*</span>
                    </Label>
                    <Select
                      value={formData.defaultStatusId}
                      onValueChange={(value) =>
                        handleFieldChange("defaultStatusId", value)
                      }
                    >
                      <SelectTrigger
                        className={`w-full border-[var(--border)] ${
                          validationErrors.defaultStatusId
                            ? "border-red-500"
                            : ""
                        }`}
                      >
                        <SelectValue placeholder="Select default status" />
                      </SelectTrigger>
                      <SelectContent className="w-full bg-[var(--card)] border-[var(--border)]">
                        {availableStatuses.map((status) => (
                          <SelectItem
                            className="hover:bg-[var(--muted)]"
                            key={status.id}
                            value={status.id}
                          >
                            <div className="flex items-center space-x-2">
                              {status.color && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: status.color }}
                                />
                              )}
                              <span>{status.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.defaultStatusId && (
                      <p className="text-sm text-red-600 mt-1">
                        {validationErrors.defaultStatusId}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="pb-2" htmlFor="defaultAssignee">
                      Default Assignee
                    </Label>
                    <SearchableAssigneeDropdown
                      value={formData.defaultAssigneeId}
                      onChange={(value) =>
                        handleFieldChange("defaultAssigneeId", value)
                      }
                      // users={availableUsers}
                      users={getCombinedUsers()}
                      onSearch={setAssigneeSearchTerm}
                    />
                  </div>
                  <div className="w-full">
                    <Label className="pb-2" htmlFor="syncInterval">
                      Sync Interval (minutes)
                    </Label>
                    <Input
                      id="syncInterval"
                      type="number"
                      value={formData.syncInterval}
                      onChange={(e) =>
                        handleFieldChange(
                          "syncInterval",
                          parseInt(e.target.value)
                        )
                      }
                      placeholder="15"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-lg py-4">
                    <div>
                      <Label
                        className="pb-2 cursor-pointer"
                        htmlFor="autoCreateTask"
                      >
                        Auto-create Tasks
                      </Label>
                      <p className="text-sm text-[var(--muted-foreground)]/60">
                        Automatically convert incoming emails to tasks
                      </p>
                    </div>
                    <Switch
                      id="autoCreateTask"
                      checked={formData.autoCreateTask}
                      onCheckedChange={(checked) =>
                        handleFieldChange("autoCreateTask", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg py-4">
                    <div>
                      <Label
                        className="pb-2 cursor-pointer"
                        htmlFor="autoReply"
                      >
                        Auto-reply
                      </Label>
                      <p className="text-sm text-[var(--muted-foreground)]/60">
                        Send automatic replies to incoming emails
                      </p>
                    </div>
                    <Switch
                      id="autoReply"
                      checked={formData.autoReplyEnabled}
                      onCheckedChange={(checked) =>
                        handleFieldChange("autoReplyEnabled", checked)
                      }
                    />
                  </div>
                </div>
                {formData.autoReplyEnabled && (
                  <div>
                    <Label className="pb-2" htmlFor="autoReplyTemplate">
                      Auto-reply Message{" "}
                      <span className="projects-form-label-required">*</span>
                    </Label>
                    <Textarea
                      id="autoReplyTemplate"
                      value={formData.autoReplyTemplate}
                      onChange={(e) =>
                        handleFieldChange("autoReplyTemplate", e.target.value)
                      }
                      placeholder="Thank you for contacting us. We'll respond within 24 hours."
                      rows={3}
                      className={
                        validationErrors.autoReplyTemplate
                          ? "border-red-500"
                          : ""
                      }
                    />
                    {validationErrors.autoReplyTemplate && (
                      <p className="text-sm text-red-600 mt-1">
                        {validationErrors.autoReplyTemplate}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label className="pb-2" htmlFor="emailSignature">
                    Email Signature
                  </Label>
                  <Textarea
                    id="emailSignature"
                    value={formData.emailSignature}
                    onChange={(e) =>
                      handleFieldChange("emailSignature", e.target.value)
                    }
                    placeholder="--&#10;Best regards,&#10;Support Team"
                    rows={3}
                  />
                  <p className="text-sm text-[var(--muted-foreground)]/60 mt-1">
                    This signature will be added to all outgoing email replies
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <ActionButton
                  type="button"
                  secondary
                  onClick={() => setShowSetupForm(false)}
                  disabled={isSaving}
                >
                  Cancel
                </ActionButton>
                <Button
                  onClick={handleCreateInbox}
                  disabled={
                    Object.keys(validationErrors).length > 0 || isSaving
                  }
                  className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium cursor-pointer rounded-lg flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <HiCog className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>Create Email Integration</>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="bg-[var(--card)] shadow-md rounded-md border-none gap-0">
        <CardHeader>
          <CardTitle className="flex items-start justify-between w-full">
            {/* Left Side */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <HiEnvelope className="w-5 h-5" />
                <span>Email Integration Status</span>
              </div>
              <p className="text-sm font-normal text-[var(--muted-foreground)]/60 mt-1">
                Manage email status of your project
              </p>
            </div>

            {/* Right Side */}
            <div className="flex flex-col items-end space-y-1">
              {/* Badge + Button */}
              <div className="flex items-center space-x-2">
                {currentInbox.emailAccount?.syncEnabled ? (
                  <Badge className="bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded-md flex items-center">
                    <HiCheckCircle className="w-4 h-4 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="flex items-center px-2 py-1"
                  >
                    <HiExclamationTriangle className="w-4 h-4 mr-1 text-yellow-600" />
                    Not Configured
                  </Badge>
                )}

                <Tooltip
                  content={`${
                    currentInbox.emailAccount
                      ? "Sync"
                      : "Email not configured yet"
                  }`}
                  position="top"
                  color="primary"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTriggerSync}
                    disabled={isSyncing || !currentInbox.emailAccount}
                    className={`border-[var(--border)] flex items-center justify-center gap-2 ${
                      !currentInbox.emailAccount && "cursor-not-allowed"
                    }`}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
                    />
                  </Button>
                </Tooltip>
              </div>

              {/* Last Sync Date */}
              <p className="text-xs font-normal text-[var(--muted-foreground)]/60">
                Last Sync:{" "}
                {currentInbox.emailAccount?.lastSyncAt
                  ? new Date(
                      currentInbox.emailAccount.lastSyncAt
                    ).toLocaleString()
                  : "Never"}
              </p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="bg-[var(--card)] rounded-md">
          {/* Sync Error Alert */}
          {currentInbox.emailAccount?.lastSyncError && (
            <Alert
              className="mt-6 flex items-center justify-center space-x-2"
              variant="destructive"
            >
              <HiExclamationTriangle className="w-5 h-5" />
              <AlertDescription>
                Last sync error: {currentInbox.emailAccount.lastSyncError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Inbox Configuration */}
      <Card className="border-none bg-[var(--card)] rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inbox Configuration</span>
            {hasUnsavedChanges && (
              <div className="flex items-center space-x-2 text-sm text-orange-600">
                <span>• Unsaved Changes</span>
              </div>
            )}
          </CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]/60">
            Click "Save Changes" to update your settings
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="pb-2" htmlFor="inboxName">
                Inbox Name{" "}
                <span className="projects-form-label-required">*</span>
              </Label>
              <Input
                id="inboxName"
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Support Inbox"
                className={validationErrors.name ? "border-red-500" : ""}
              />
              {validationErrors.name && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.name}
                </p>
              )}
            </div>

            <div>
              <Label className="pb-2" htmlFor="emailAddress">
                Email Address
              </Label>
              <Input
                id="emailAddress"
                type="email"
                value={formData.emailAddress}
                onChange={(e) =>
                  handleFieldChange("emailAddress", e.target.value)
                }
                placeholder="support@company.com"
                className={
                  validationErrors.emailAddress ? "border-red-500" : ""
                }
              />
              {validationErrors.emailAddress && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.emailAddress}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="pb-2" htmlFor="description">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Customer support email integration"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {/* Default Task Type */}
            <div className="w-full">
              <Label className="pb-2" htmlFor="defaultTaskType">
                Default Task Type
              </Label>
              <Select
                value={formData.defaultTaskType}
                onValueChange={(value) =>
                  handleFieldChange(
                    "defaultTaskType",
                    value as FormData["defaultTaskType"]
                  )
                }
              >
                <SelectTrigger className="w-full border-[var(--border)]">
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent className="w-full bg-[var(--card)] border-[var(--border)]">
                  <SelectItem className="hover:bg-[var(--muted)]" value="TASK">
                    Task
                  </SelectItem>
                  <SelectItem className="hover:bg-[var(--muted)]" value="BUG">
                    Bug
                  </SelectItem>
                  <SelectItem className="hover:bg-[var(--muted)]" value="EPIC">
                    Epic
                  </SelectItem>
                  <SelectItem className="hover:bg-[var(--muted)]" value="STORY">
                    Story
                  </SelectItem>
                  <SelectItem
                    className="hover:bg-[var(--muted)]"
                    value="SUBTASK"
                  >
                    Subtask
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Priority */}
            <div className="w-full">
              <Label className="pb-2" htmlFor="defaultPriority">
                Default Priority
              </Label>
              <Select
                value={formData.defaultPriority}
                onValueChange={(value) =>
                  handleFieldChange(
                    "defaultPriority",
                    value as FormData["defaultPriority"]
                  )
                }
              >
                <SelectTrigger className="w-full border-[var(--border)]">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="w-full bg-[var(--card)] border-[var(--border)]">
                  <SelectItem className="hover:bg-[var(--muted)]" value="LOW">
                    Low
                  </SelectItem>
                  <SelectItem
                    className="hover:bg-[var(--muted)]"
                    value="MEDIUM"
                  >
                    Medium
                  </SelectItem>
                  <SelectItem className="hover:bg-[var(--muted)]" value="HIGH">
                    High
                  </SelectItem>
                  <SelectItem
                    className="hover:bg-[var(--muted)]"
                    value="HIGHEST"
                  >
                    Highest
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Status */}
            <div className="w-full">
              <Label className="pb-2" htmlFor="defaultStatus">
                Default Status{" "}
                <span className="projects-form-label-required">*</span>
              </Label>
              <Select
                value={formData.defaultStatusId}
                onValueChange={(value) =>
                  handleFieldChange("defaultStatusId", value)
                }
              >
                <SelectTrigger
                  className={`w-full border-[var(--border)] ${
                    validationErrors.defaultStatusId ? "border-red-500" : ""
                  }`}
                >
                  <SelectValue placeholder="Select default status" />
                </SelectTrigger>
                <SelectContent className="w-full bg-[var(--card)] border-[var(--border)]">
                  {availableStatuses
                    .filter((status) => !!status.id && status.id.trim() !== "")
                    .map((status) => (
                      <SelectItem
                        className="hover:bg-[var(--muted)]"
                        key={status.id}
                        value={status.id}
                      >
                        <div className="flex items-center space-x-2">
                          {status.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: status.color }}
                            />
                          )}
                          <span>{status.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {validationErrors.defaultStatusId && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.defaultStatusId}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <div className="w-full">
              <Label className="pb-2" htmlFor="defaultAssignee">
                Default Assignee
              </Label>
              <SearchableAssigneeDropdown
                value={formData.defaultAssigneeId}
                onChange={(value) =>
                  handleFieldChange("defaultAssigneeId", value)
                }
                // users={availableUsers}
                users={getCombinedUsers()}
                onSearch={setAssigneeSearchTerm}
              />
            </div>
            <div className="w-full">
              <Label className="pb-2" htmlFor="syncInterval">
                Sync Interval (minutes)
              </Label>
              <Input
                id="syncInterval"
                type="number"
                value={formData.syncInterval}
                onChange={(e) =>
                  handleFieldChange("syncInterval", parseInt(e.target.value))
                }
                placeholder="15"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border-[var(--border)]">
              <div>
                <Label className="pb-2 cursor-pointer" htmlFor="autoCreateTask">
                  Auto-create Tasks
                </Label>
                <p className="text-sm text-[var(--muted-foreground)]/60">
                  Automatically convert incoming emails to tasks
                </p>
              </div>
              <Switch
                id="autoCreateTask"
                checked={formData.autoCreateTask}
                onCheckedChange={(checked) =>
                  handleFieldChange("autoCreateTask", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border-[var(--border)]">
              <div>
                <Label className="pb-2 cursor-pointer" htmlFor="autoReply">
                  Auto-reply
                </Label>
                <p className="text-sm text-[var(--muted-foreground)]/60">
                  Send automatic replies to incoming emails
                </p>
              </div>
              <Switch
                id="autoReply"
                checked={formData.autoReplyEnabled}
                onCheckedChange={(checked) =>
                  handleFieldChange("autoReplyEnabled", checked)
                }
              />
            </div>
          </div>

          {formData.autoReplyEnabled && (
            <div>
              <Label className="pb-2" htmlFor="autoReplyTemplate">
                Auto-reply Message{" "}
                <span className="projects-form-label-required">*</span>
              </Label>
              <Textarea
                id="autoReplyTemplate"
                value={formData.autoReplyTemplate}
                onChange={(e) =>
                  handleFieldChange("autoReplyTemplate", e.target.value)
                }
                placeholder="Eg: Thank you for contacting us. We'll respond within 24 hours."
                rows={3}
                className={
                  validationErrors.autoReplyTemplate ? "border-red-500" : ""
                }
              />
              {validationErrors.autoReplyTemplate && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.autoReplyTemplate}
                </p>
              )}
            </div>
          )}

          <div>
            <Label className="pb-2" htmlFor="emailSignature">
              Email Signature
            </Label>
            <Textarea
              id="emailSignature"
              value={formData.emailSignature}
              onChange={(e) =>
                handleFieldChange("emailSignature", e.target.value)
              }
              placeholder="--&#10;Best regards,&#10;Support Team"
              rows={4}
            />
            <p className="text-sm text-[var(--muted-foreground)]/60 mt-2">
              This signature will be added to all outgoing email replies
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            {hasUnsavedChanges && (
              <Button
                variant="outline"
                onClick={() => {
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
                      syncInterval: currentInbox.syncInterval || 15,
                    });
                    setHasUnsavedChanges(false);
                    setValidationErrors({});
                  }
                }}
                className="border-[var(--border)]"
              >
                Reset Changes
              </Button>
            )}
            <ActionButton
              onClick={handleUpdateInbox}
              disabled={
                !hasUnsavedChanges ||
                Object.keys(validationErrors).length > 0 ||
                isSaving
              }
              primary
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <HiCog className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </div>
              ) : (
                <>Save Changes</>
              )}
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      {/* Email Account */}
      <Card className="border-none bg-[var(--card)] rounded-md">
        <CardHeader>
          <CardTitle>Email Account</CardTitle>
        </CardHeader>
        <CardContent>
          {currentInbox.emailAccount ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-[var(--border)] rounded-lg">
                <div>
                  <div className="font-medium">
                    {currentInbox.emailAccount.emailAddress}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]/60">
                    {currentInbox.emailAccount.displayName || "No display name"}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]/50 mt-1">
                    IMAP: {currentInbox.emailAccount.imapHost}:
                    {currentInbox.emailAccount.imapPort}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWizard(true)}
                    className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium cursor-pointer rounded-lg flex items-center gap-2"
                  >
                    <HiCog className="w-4 h-4 mr-1" />
                    Reconfigure
                  </Button>
                </div>
              </div>

              <div className="text-sm text-[var(--muted-foreground)]/60">
                <strong>Sync Status:</strong>{" "}
                {currentInbox.emailAccount.syncEnabled ? "Enabled" : "Disabled"}
                {currentInbox.emailAccount.lastSyncAt && (
                  <>
                    {" "}
                    • Last sync:{" "}
                    {new Date(
                      currentInbox.emailAccount.lastSyncAt
                    ).toLocaleString()}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 flex flex-col items-center justify-center">
              <HiEnvelope className="w-8 h-8 mx-auto text-[var(--muted-foreground)]/40 mb-2" />
              <p className="text-[var(--muted-foreground)]/60 mb-4">
                No email account configured
              </p>
              <ActionButton
                showPlusIcon
                primary
                onClick={() => setShowWizard(true)}
              >
                Add Email Account
              </ActionButton>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
