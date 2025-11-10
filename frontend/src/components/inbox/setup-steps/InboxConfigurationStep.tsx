import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InboxFormData } from "@/types/emailIntegration";
import SearchableAssigneeDropdown from "@/components/shared/SearchableAssigneeDropdown";
import ActionButton from "@/components/common/ActionButton";

interface InboxConfigurationStepProps {
  formData: InboxFormData;
  validationErrors: Record<string, string>;
  availableStatuses: any[];
  availableUsers: any[];
  isSaving: boolean;
  onFieldChange: (field: keyof InboxFormData, value: any) => void;
  onSubmit: () => void;
  onAssigneeSearch: (term: string) => void;
}

export default function InboxConfigurationStep({
  formData,
  validationErrors,
  availableStatuses,
  availableUsers,
  isSaving,
  onFieldChange,
  onSubmit,
  onAssigneeSearch,
}: InboxConfigurationStepProps) {
  return (
    <div className=" mt-0 animate-fadeIn">
      <div className="space-y-5">
        <div>
          <Label className="pb-2 text-sm font-medium" htmlFor="inboxName">
            Inbox Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="inboxName"
            value={formData.name}
            onChange={(e) => onFieldChange("name", e.target.value)}
            placeholder="Support Inbox"
            className={`h-10 ${validationErrors.name ? "border-red-500" : ""}`}
          />
          {validationErrors.name && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
          )}
        </div>

        <div>
          <Label className="pb-2 text-sm font-medium" htmlFor="description">
            Description
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
            placeholder="Customer support email integration"
            rows={2}
          />
        </div>

        <div>
          <Label className="pb-2 text-sm font-medium" htmlFor="emailAddress">
            Email Address
          </Label>
          <Input
            id="emailAddress"
            type="email"
            value={formData.emailAddress}
            onChange={(e) => onFieldChange("emailAddress", e.target.value)}
            placeholder="support@company.com"
            className={`h-10 ${validationErrors.emailAddress ? "border-red-500" : ""}`}
          />
          {validationErrors.emailAddress && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.emailAddress}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="pb-2 text-sm font-medium" htmlFor="defaultTaskType">
              Default Task Type
            </Label>
            <Select
              value={formData.defaultTaskType}
              onValueChange={(value) =>
                onFieldChange("defaultTaskType", value as InboxFormData["defaultTaskType"])
              }
            >
              <SelectTrigger className="w-full border-[var(--border)] h-10">
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--card)] border-[var(--border)]">
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
                <SelectItem className="hover:bg-[var(--muted)]" value="SUBTASK">
                  Subtask
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="pb-2 text-sm font-medium" htmlFor="defaultPriority">
              Default Priority
            </Label>
            <Select
              value={formData.defaultPriority}
              onValueChange={(value) =>
                onFieldChange("defaultPriority", value as InboxFormData["defaultPriority"])
              }
            >
              <SelectTrigger className="w-full border-[var(--border)] h-10">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                <SelectItem className="hover:bg-[var(--muted)]" value="LOW">
                  Low
                </SelectItem>
                <SelectItem className="hover:bg-[var(--muted)]" value="MEDIUM">
                  Medium
                </SelectItem>
                <SelectItem className="hover:bg-[var(--muted)]" value="HIGH">
                  High
                </SelectItem>
                <SelectItem className="hover:bg-[var(--muted)]" value="HIGHEST">
                  Highest
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="pb-2 text-sm font-medium" htmlFor="defaultStatus">
              Default Status <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.defaultStatusId}
              onValueChange={(value) => onFieldChange("defaultStatusId", value)}
            >
              <SelectTrigger
                className={`w-full border-[var(--border)] h-10 ${
                  validationErrors.defaultStatusId ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Select default status" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                {availableStatuses.map((status) => (
                  <SelectItem className="hover:bg-[var(--muted)]" key={status.id} value={status.id}>
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
              <p className="text-sm text-red-600 mt-1">{validationErrors.defaultStatusId}</p>
            )}
          </div>

          <div>
            <Label className="pb-2 text-sm font-medium" htmlFor="defaultAssignee">
              Default Assignee
            </Label>
            <SearchableAssigneeDropdown
              value={formData.defaultAssigneeId}
              onChange={(value) => onFieldChange("defaultAssigneeId", value)}
              users={availableUsers}
              onSearch={onAssigneeSearch}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="pb-2 cursor-pointer text-sm font-medium" htmlFor="autoCreateTask">
                Auto-create Tasks
              </Label>
              <p className="text-sm text-[var(--muted-foreground)]/60">
                Automatically convert emails to tasks
              </p>
            </div>
            <Switch
              id="autoCreateTask"
              checked={formData.autoCreateTask}
              onCheckedChange={(checked) => onFieldChange("autoCreateTask", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="pb-2 cursor-pointer text-sm font-medium" htmlFor="autoReply">
                Auto-reply
              </Label>
              <p className="text-sm text-[var(--muted-foreground)]/60">Send automatic replies</p>
            </div>
            <Switch
              id="autoReply"
              checked={formData.autoReplyEnabled}
              onCheckedChange={(checked) => onFieldChange("autoReplyEnabled", checked)}
            />
          </div>
        </div>

        {formData.autoReplyEnabled && (
          <div>
            <Label className="pb-2 text-sm font-medium" htmlFor="autoReplyTemplate">
              Auto-reply Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="autoReplyTemplate"
              value={formData.autoReplyTemplate}
              onChange={(e) => onFieldChange("autoReplyTemplate", e.target.value)}
              placeholder="Thank you for contacting us. We'll respond within 24 hours."
              rows={3}
              className={validationErrors.autoReplyTemplate ? "border-red-500" : ""}
            />
            {validationErrors.autoReplyTemplate && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.autoReplyTemplate}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <ActionButton onClick={onSubmit} disabled={isSaving} primary>
          {isSaving ? <>Creating...</> : <>{"Next"}</>}
        </ActionButton>
      </div>
    </div>
  );
}
