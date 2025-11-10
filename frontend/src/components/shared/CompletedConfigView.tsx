import React, { useState } from "react";
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
import { HiEnvelope, HiCog, HiCheckCircle, HiExclamationTriangle } from "react-icons/hi2";
import { RefreshCw } from "lucide-react";
import { InboxFormData } from "@/types/emailIntegration";
import SearchableAssigneeDropdown from "./SearchableAssigneeDropdown";
import Tooltip from "@/components/common/ToolTip";
import ActionButton from "../common/ActionButton";

import RichTextEditor from "@/components/common/RichTextEditor";
import { EditorState, ContentState, convertToRaw } from "draft-js";
import draftToHtml from "draftjs-to-html";
import { DangerouslyHTMLComment } from "../common/DangerouslyHTMLComment";
import { HiEye, HiPencil } from "react-icons/hi";

let htmlToDraft: any;
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  htmlToDraft = require("html-to-draftjs").default;
}

interface CompletedConfigViewProps {
  currentInbox: any;
  formData: InboxFormData;
  validationErrors: Record<string, string>;
  availableStatuses: any[];
  availableUsers: any[];
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  onFieldChange: (field: keyof InboxFormData, value: any) => void;
  onSave: () => void;
  onReset: () => void;
  onTriggerSync: () => void;
  onReconfigure: () => void;
  onAssigneeSearch: (term: string) => void;
}

export default function CompletedConfigView({
  currentInbox,
  formData,
  validationErrors,
  availableStatuses,
  availableUsers,
  hasUnsavedChanges,
  isSaving,
  isSyncing,
  onFieldChange,
  onSave,
  onReset,
  onTriggerSync,
  onReconfigure,
  onAssigneeSearch,
}: CompletedConfigViewProps) {
  const [showPreview, setShowPreview] = useState(false);

  const [editorState, setEditorState] = useState(() => {
    if (formData.emailSignature) {
      try {
        const isHTML = /<[a-z][\s\S]*>/i.test(formData.emailSignature);

        if (isHTML) {
          const blocksFromHtml = htmlToDraft(formData.emailSignature);
          const { contentBlocks, entityMap } = blocksFromHtml;
          const contentState = ContentState.createFromBlockArray(contentBlocks, entityMap);
          return EditorState.createWithContent(contentState);
        } else {
          return EditorState.createWithContent(
            ContentState.createFromText(formData.emailSignature)
          );
        }
      } catch (error) {
        console.error("Error initializing editor state:", error);
        return EditorState.createEmpty();
      }
    }
    return EditorState.createEmpty();
  });

  const handleEditorChange = (newEditorState: EditorState) => {
    setEditorState(newEditorState);

    const contentState = newEditorState.getCurrentContent();
    const htmlContent = draftToHtml(convertToRaw(contentState));
    onFieldChange("emailSignature", htmlContent);
  };

  const getPreviewContent = () => {
    return formData.emailSignature || "";
  };
  return (
    <div className="space-y-6">
      <Card className="border-none gap-0 bg-[var(--card)]">
        <CardHeader>
          <CardTitle className="flex items-start justify-between w-full">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <HiEnvelope className="w-5 h-5 text-[var(--primary)]" />

                <span className="text-md font-semibold">Email Integration Configuration</span>
              </div>
              <p className="text-sm font-normal text-[var(--muted-foreground)]/60 mt-2">
                Manage email status of your project
              </p>
            </div>

            <div className="flex flex-col items-end space-y-2">
              <div className="flex items-center space-x-2">
                {currentInbox.emailAccount?.syncEnabled ? (
                  <Badge className="bg-green-100 text-green-700 border border-green-200 px-3 py-1 rounded-lg flex items-center">
                    <HiCheckCircle className="w-4 h-4 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center px-3 py-1">
                    <HiExclamationTriangle className="w-4 h-4 mr-1 text-yellow-600" />
                    Not Configured
                  </Badge>
                )}

                <Tooltip content="Sync emails now" position="top" color="primary">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onTriggerSync}
                    disabled={isSyncing || !currentInbox.emailAccount}
                    className="border-[var(--border)] hover:bg-[var(--muted)]"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  </Button>
                </Tooltip>
              </div>

              <p className="text-xs font-normal text-[var(--muted-foreground)]/60">
                Last Sync:{" "}
                {currentInbox.emailAccount?.lastSyncAt
                  ? new Date(currentInbox.emailAccount.lastSyncAt).toLocaleString()
                  : "Never"}
              </p>
              {hasUnsavedChanges && (
                <p className="text-xs text-orange-600 mt-1 font-normal">• Unsaved Changes</p>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {currentInbox.emailAccount?.lastSyncError && (
            <Alert className="flex items-center justify-center space-x-2" variant="destructive">
              <HiExclamationTriangle className="w-5 h-5" />
              <AlertDescription>
                Last sync error: {currentInbox.emailAccount.lastSyncError}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <SelectItem value="TASK">Task</SelectItem>
                  <SelectItem value="BUG">Bug</SelectItem>
                  <SelectItem value="EPIC">Epic</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                  <SelectItem value="SUBTASK">Subtask</SelectItem>
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
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="HIGHEST">Highest</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                  {availableStatuses
                    .filter((status) => !!status.id && status.id.trim() !== "")
                    .map((status) => (
                      <SelectItem key={status.id} value={status.id}>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div>
              <Label className="pb-2 text-sm font-medium" htmlFor="syncInterval">
                Sync Interval (minutes)
              </Label>
              <Input
                id="syncInterval"
                type="number"
                value={formData.syncInterval}
                onChange={(e) => onFieldChange("syncInterval", parseInt(e.target.value))}
                placeholder="5"
                className="h-10"
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
                  Automatically convert incoming emails to tasks
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
                <p className="text-sm text-[var(--muted-foreground)]/60">
                  Send automatic replies to incoming emails
                </p>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="pb-2 text-sm font-medium" htmlFor="emailSignature">
                Email Signature
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 border-[var(--border)] hover:bg-[var(--muted)]"
              >
                {showPreview ? (
                  <>
                    <HiPencil className="w-4 h-4" />
                    Continue Edit
                  </>
                ) : (
                  <>
                    <HiEye className="w-4 h-4" />
                    Preview
                  </>
                )}
              </Button>
            </div>
            {showPreview ? (
              <div className="mt-4 p-4 border border-[var(--border)] rounded-lg bg-white">
                <DangerouslyHTMLComment comment={getPreviewContent()} />
              </div>
            ) : (
              <div className="border border-[var(--border)] rounded-md p-2 bg-[var(--background)]">
                <RichTextEditor
                  editorState={editorState}
                  onChange={handleEditorChange}
                  placeholder="--&#10;Best regards,&#10;Support Team"
                />
              </div>
            )}
            <p className="text-sm text-[var(--muted-foreground)]/60 mt-2">
              This signature will be added to all outgoing email replies
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            {hasUnsavedChanges && (
              <ActionButton secondary onClick={onReset}>
                Reset Changes
              </ActionButton>
            )}
            <ActionButton
              onClick={onSave}
              disabled={!hasUnsavedChanges || Object.keys(validationErrors).length > 0 || isSaving}
              primary
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <HiCog className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </div>
              ) : (
                "Save Changes"
              )}
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      {/* Email Account */}
      <Card className="border-none gap-0 bg-[var(--card)]">
        <CardHeader className=" border-none">
          <CardTitle className="text-md font-semibold border-none">Email Account</CardTitle>
        </CardHeader>
        <CardContent className="">
          {currentInbox.emailAccount ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[var(--muted)]/30 rounded-lg border border-[var(--border)]">
                <div className="space-y-1">
                  <div className="font-semibold text-sm">
                    {currentInbox.emailAccount.emailAddress}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]/70">
                    {currentInbox.emailAccount.displayName || "No display name"}
                  </div>
                  <div className="text-[13px] text-[var(--muted-foreground)]/60">
                    IMAP: {currentInbox.emailAccount.imapHost}:{currentInbox.emailAccount.imapPort}
                  </div>
                </div>
                <ActionButton onClick={onReconfigure} primary>
                  Reconfigure
                </ActionButton>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 flex flex-col items-center justify-center">
              <HiEnvelope className="w-12 h-12 mx-auto text-[var(--muted-foreground)]/40 mb-3" />
              <p className="text-[var(--muted-foreground)]/70 mb-4">No email account configured</p>
              <Button
                onClick={onReconfigure}
                className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white"
              >
                <HiEnvelope className="w-4 h-4 mr-2" />
                Add Email Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
