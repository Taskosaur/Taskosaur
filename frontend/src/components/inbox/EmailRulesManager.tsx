import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HiPencil, HiTrash, HiCheckCircle } from "react-icons/hi2";
import { IoWarning } from "react-icons/io5";
import { inboxApi } from "@/utils/api/inboxApi";
import { InboxRule } from "@/types/inbox";
import ActionButton from "../common/ActionButton";
import Tooltip from "../common/ToolTip";
import { ACTION_TYPES, EMAIL_FIELDS, EMAIL_OPERATORS } from "@/utils/data/projectData";
import { PRIORITY_OPTIONS } from "@/utils/data/taskData";
import { useProject } from "@/contexts/project-context";
import { useTask } from "@/contexts/task-context";
import ConfirmationModal from "../modals/ConfirmationModal";
import { ActionValueSelector } from "../projects/ActionValueSelector";
import { useInbox } from "@/contexts/inbox-context";

interface EmailRulesManagerProps {
  projectId: string;
}

interface RuleCondition {
  field: "subject" | "from" | "to" | "body" | "cc";
  operator: "contains" | "equals" | "matches" | "startsWith" | "endsWith";
  value: string;
}

interface RuleAction {
  type: "setPriority" | "assignTo" | "addLabels" | "markAsSpam" | "autoReply";
  value: string | string[];
}

interface RuleFormData {
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  stopOnMatch: boolean;
}

interface NormalizedMember {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
}

const defaultRule: RuleFormData = {
  name: "",
  description: "",
  priority: 0,
  enabled: true,
  conditions: [{ field: "subject", operator: "contains", value: "" }],
  actions: [{ type: "setPriority", value: "MEDIUM" }],
  stopOnMatch: false,
};

export default function EmailRulesManager({ projectId }: EmailRulesManagerProps) {
  const [rules, setRules] = useState<InboxRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<InboxRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(defaultRule);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<NormalizedMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [labels, setLabels] = useState<any[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<InboxRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { getProjectMembers } = useProject();
  const { getProjectLabels } = useTask();
  const { currentInbox, getInbox, setCurrentInbox } = useInbox();

  const loadInboxData = async () => {
    try {
      const inbox = await getInbox(projectId); // assuming this sets currentInbox internally
      if (inbox) {
        await loadRules(); // only load rules if inbox exists
      } else {
        setCurrentInbox(null);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setCurrentInbox(null);
      } else {
        toast.error("Failed to load email integration settings");
      }
    }
  };

  useEffect(() => {
    loadInboxData();
  }, [projectId]);

  useEffect(() => {
    if (formData.actions.some((a) => a.type === "assignTo")) {
      setMembersLoading(true);
      getProjectMembers(projectId)
        .then((data: any[]) => {
          if (!Array.isArray(data)) {
            setMembers([]);
            return;
          }

          const normalizedMembers = data
            .filter((m) => m?.user?.id)
            .map((m) => ({
              id: m.user.id,
              name:
                `${m.user.firstName || ""} ${m.user.lastName || ""}`.trim() ||
                m.user.email ||
                "Unknown User",
              email: m.user.email || "",
              avatar: m.user.avatar || null,
              role: m.role || "MEMBER",
            }));

          setMembers(normalizedMembers);
        })
        .catch((error) => {
          console.error("Failed to fetch members:", error);
          setMembers([]);
        })
        .finally(() => setMembersLoading(false));
    } else {
      setMembers([]);
      setMembersLoading(false);
    }

    if (formData.actions.some((a) => a.type === "addLabels")) {
      setLabelsLoading(true);
      getProjectLabels(projectId)
        .then((data: any[]) => {
          setLabels(Array.isArray(data) ? data : []);
        })
        .catch((error) => {
          console.error("Failed to fetch labels:", error);
          setLabels([]);
        })
        .finally(() => setLabelsLoading(false));
    } else {
      setLabels([]);
      setLabelsLoading(false);
    }
  }, [formData.actions, projectId]);

  const loadRules = async () => {
    try {
      const rulesData = await inboxApi.getRules(projectId);
      setRules(rulesData);
    } catch (error) {
      toast.error("Failed to load rules");
    }
  };

  const handleSaveRule = async () => {
    if (!formData.name.trim()) {
      toast.error("Rule name is required");
      return;
    }

    if (formData.conditions.some((c) => !c.value.trim())) {
      toast.error("All condition values are required");
      return;
    }

    // Validate auto-reply actions have a template
    const autoReplyAction = formData.actions.find((a) => a.type === "autoReply");
    if (autoReplyAction && (!autoReplyAction.value || !(autoReplyAction.value as string).trim())) {
      toast.error("Auto-reply message template is required");
      return;
    }

    try {
      setSaving(true);
      const ruleData = {
        ...formData,
        conditions: {
          all: formData.conditions.map((c) => ({
            [c.field]: { [c.operator]: c.value },
          })),
        },
        actions: formData.actions.reduce((acc, action) => {
          acc[action.type] = action.value;
          return acc;
        }, {} as any),
      };

      if (editingRule) {
        await inboxApi.updateRule(projectId, editingRule.id, ruleData);
        toast.success("Rule updated successfully");
      } else {
        await inboxApi.createRule(projectId, ruleData);
        toast.success("Rule created successfully");
      }

      await loadRules();
      setShowForm(false);
      setEditingRule(null);
      setFormData(defaultRule);
    } catch (error) {
      toast.error("Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const handleEditRule = (rule: InboxRule) => {
    setEditingRule(rule);

    const conditions: RuleCondition[] = [];
    if (rule.conditions && typeof rule.conditions === "object") {
      const conditionsObj = rule.conditions as any;
      if (conditionsObj.all && Array.isArray(conditionsObj.all)) {
        conditionsObj.all.forEach((cond: any) => {
          Object.keys(cond).forEach((field) => {
            Object.keys(cond[field]).forEach((operator) => {
              conditions.push({
                field: field as RuleCondition["field"],
                operator: operator as RuleCondition["operator"],
                value: cond[field][operator],
              });
            });
          });
        });
      }
    }

    const actions: RuleAction[] = [];
    if (rule.actions && typeof rule.actions === "object") {
      const actionsObj = rule.actions as any;
      Object.keys(actionsObj).forEach((actionType) => {
        actions.push({
          type: actionType as RuleAction["type"],
          value: actionsObj[actionType],
        });
      });
    }

    setFormData({
      name: rule.name,
      description: rule.description || "",
      priority: rule.priority,
      enabled: rule.enabled,
      conditions:
        conditions.length > 0
          ? conditions
          : [{ field: "subject", operator: "contains", value: "" }],
      actions: actions.length > 0 ? actions : [{ type: "setPriority", value: "MEDIUM" }],
      stopOnMatch: rule.stopOnMatch,
    });
    setShowForm(true);
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;

    try {
      setIsDeleting(true);
      await inboxApi.deleteRule(projectId, deletingRule.id);
      toast.success("Rule deleted successfully");
      await loadRules();
    } catch (error) {
      toast.error("Failed to delete rule");
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setDeletingRule(null);
    }
  };

  const openDeleteModal = (rule: InboxRule) => {
    setDeletingRule(rule);
    setIsDeleteModalOpen(true);
  };

  const addCondition = () => {
    setFormData((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: "subject", operator: "contains", value: "" }],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const updateCondition = (index: number, field: keyof RuleCondition, value: string) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === index ? { ...cond, [field]: value } : cond
      ),
    }));
  };

  const addAction = () => {
    setFormData((prev) => ({
      ...prev,
      actions: [...prev.actions, { type: "setPriority", value: "MEDIUM" }],
    }));
  };

  const removeAction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const updateAction = (index: number, field: keyof RuleAction, value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.map((action, i) => {
        if (i !== index) return action;

        // When changing action type, reset the value to appropriate default
        if (field === "type") {
          const newType = value as RuleAction["type"];
          let defaultValue: string | string[] = "";

          switch (newType) {
            case "setPriority":
              defaultValue = "MEDIUM";
              break;
            case "autoReply":
              defaultValue = ""; // Empty template that user will fill in
              break;
            case "assignTo":
            case "addLabels":
              defaultValue = "";
              break;
            case "markAsSpam":
              defaultValue = "true";
              break;
          }

          return { ...action, type: newType, value: defaultValue } as RuleAction;
        }

        return { ...action, [field]: value } as RuleAction;
      }),
    }));
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 90) return "bg-red-100 text-red-800 ";
    if (priority >= 70) return "bg-orange-100 text-orange-800";
    if (priority >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <Card className="border-none bg-[var(--card)] rounded-md gap-2">
        <CardHeader className="border-b border-[var(--border)]">
          <div className="flex w-full items-start justify-between">
            <CardTitle className="flex items-start gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <IoWarning className="w-5 h-5 text-[var(--primary)]" />
                  <span className="text-md font-semibold">Email Processing Rules</span>
                </div>
                <p className="text-sm font-normal text-[var(--muted-foreground)]/60 mt-2">
                  Automatically process incoming emails based on conditions
                </p>
              </div>
            </CardTitle>
            {currentInbox && (
              <ActionButton
                primary
                showPlusIcon
                onClick={() => {
                  setShowForm(true);
                  setEditingRule(null);
                  setFormData(defaultRule);
                }}
              >
                Add Rule
              </ActionButton>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentInbox ? (
            <>
              {rules.length === 0 && !showForm ? (
                <div className="text-center py-8">
                  <IoWarning className="w-7 h-7 mx-auto text-[var(--muted-foreground)]/40 mb-2" />
                  <h3 className="text-sm font-semibold">No Rules Configured</h3>
                  <p className="text-[var(--muted-foreground)]/60 text-sm">
                    Create rules to automatically process incoming emails
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(rules) &&
                    rules.map((rule) => (
                      <div key={rule.id} className="border border-[var(--border)] rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm">{rule.name}</h4>
                              <Badge className={getPriorityColor(rule.priority)}>
                                Priority {rule.priority}
                              </Badge>
                              {rule.enabled ? (
                                <Badge className="bg-green-100 text-green-800 ">
                                  <HiCheckCircle className="w-3 h-3 mr-1" />
                                  Enabled
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Disabled</Badge>
                              )}
                            </div>
                            {rule.description && (
                              <p className="text-xs text-[var(--muted-foreground)]/60">
                                {rule.description}
                              </p>
                            )}
                            <div className="text-[13px] text-[var(--muted-foreground)]/50">
                              Stop on match: {rule.stopOnMatch ? "Yes" : "No"}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Tooltip content="Edit" position="top" color="primary">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRule(rule)}
                                className="border border-[var(--border)]"
                              >
                                <HiPencil className="size-3" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Delete" position="top" color="primary">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteModal(rule)}
                                className="border border-[var(--border)] text-red-400"
                              >
                                <HiTrash className="size-3" />
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-center py-8">
                <IoWarning className="w-7 h-7 mx-auto text-[var(--muted-foreground)]/40 mb-2" />
                <h3 className="text-sm font-semibold">No Project Inbox Configured</h3>
                <p className="text-[var(--muted-foreground)]/60 text-sm">
                  Please set up a project inbox before adding rules.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-none bg-[var(--card)] rounded-md">
          <CardHeader>
            <CardTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="pb-2" htmlFor="name">
                  Rule Name <span className="projects-form-label-required">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="High Priority Support"
                />
              </div>
              <div>
                <Label className="pb-2" htmlFor="priority">
                  Priority
                </Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <Label className="pb-2" htmlFor="description">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Automatically prioritize urgent emails from VIP clients"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="pb-2" htmlFor="enabled">
                    Enable Rule
                  </Label>
                  <p className="text-sm text-[var(--muted-foreground)]/60">
                    Rule will be active and process emails
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="pb-2" htmlFor="stopOnMatch">
                    Stop on Match
                  </Label>
                  <p className="text-sm text-[var(--muted-foreground)]/60">
                    Stop processing other rules if this one matches
                  </p>
                </div>
                <Switch
                  id="stopOnMatch"
                  checked={formData.stopOnMatch}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, stopOnMatch: checked }))
                  }
                />
              </div>
            </div>
            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>
                  Conditions (All must match)
                  <span className="projects-form-label-required">*</span>
                </Label>
                <ActionButton
                  showPlusIcon
                  secondary
                  className="border-none bg-[var(--card)]"
                  onClick={addCondition}
                >
                  Add Condition
                </ActionButton>
              </div>

              <div className="space-y-3">
                {formData.conditions.map((condition, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 border-none bg-[var(--card)] rounded-lg"
                  >
                    <Select
                      value={condition.field}
                      onValueChange={(value) => updateCondition(index, "field", value)}
                    >
                      <SelectTrigger className="w-32 border border-[var(--border)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--card)] border border-[var(--border)]">
                        {EMAIL_FIELDS.map((field) => (
                          <SelectItem
                            key={field.value}
                            className="hover:bg-[var(--hover-bg)]"
                            value={field.value}
                          >
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, "operator", value)}
                    >
                      <SelectTrigger className="w-32 border border-[var(--border)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--card)] border border-[var(--border)]">
                        {EMAIL_OPERATORS.map((op) => (
                          <SelectItem
                            key={op.value}
                            className="hover:bg-[var(--hover-bg)]"
                            value={op.value}
                          >
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(index, "value", e.target.value)}
                      placeholder="Enter value..."
                      className="flex-1"
                    />

                    {formData.conditions.length > 1 && (
                      <Tooltip content="Delete Condition" position="left" color="primary">
                        <ActionButton
                          variant="outline"
                          className="justify-center cursor-pointer border-none bg-[var(--destructive)]/5 hover:bg-[var(--destructive)]/10 text-[var(--destructive)]"
                          onClick={() => removeCondition(index)}
                        >
                          <HiTrash className="w-4 h-4" />
                        </ActionButton>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2 ">
                <Label>Actions</Label>
                <ActionButton
                  showPlusIcon
                  secondary
                  className="border-none bg-[var(--card)]"
                  onClick={addAction}
                >
                  Add Action
                </ActionButton>
              </div>

              <div className="space-y-3">
                {formData.actions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 border-none bg-[var(--card)] rounded-lg"
                  >
                    {/* First dropdown: Action type */}
                    <Select
                      value={action.type}
                      onValueChange={(value) => updateAction(index, "type", value)}
                    >
                      <SelectTrigger className="w-40 border border-[var(--border)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--card)] border border-[var(--border)]">
                        {ACTION_TYPES.map((type) => (
                          <SelectItem
                            key={type.value}
                            className="hover:bg-[var(--hover-bg)]"
                            value={type.value}
                          >
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Action value selector */}
                    <ActionValueSelector
                      actionType={action.type}
                      value={action.value}
                      onChange={(val) => updateAction(index, "value", val)}
                      options={
                        action.type === "setPriority"
                          ? PRIORITY_OPTIONS.map((opt) => ({
                              id: opt.value,
                              value: opt.value,
                              label: opt.label,
                            }))
                          : action.type === "assignTo"
                            ? members.map((m) => ({
                                id: m.id,
                                value: m.id,
                                label: m.name,
                                avatar: m.avatar,
                                email: m.email,
                              }))
                            : action.type === "addLabels"
                              ? labels.map((l) => ({
                                  id: l.id,
                                  value: l.id,
                                  label: l.name,
                                  color: l.color,
                                }))
                              : []
                      }
                      isLoading={
                        (action.type === "assignTo" && membersLoading) ||
                        (action.type === "addLabels" && labelsLoading)
                      }
                      showAvatar={action.type === "assignTo"}
                      showEmail={action.type === "assignTo"}
                      showColorIndicator={action.type === "addLabels"}
                      placeholder={
                        action.type === "setPriority"
                          ? "Select priority"
                          : action.type === "assignTo"
                            ? "Select member"
                            : action.type === "addLabels"
                              ? "Select label"
                              : undefined
                      }
                      loadingText={
                        action.type === "assignTo"
                          ? "Loading members..."
                          : action.type === "addLabels"
                            ? "Loading labels..."
                            : undefined
                      }
                      emptyText={
                        action.type === "assignTo"
                          ? "No members available"
                          : action.type === "addLabels"
                            ? "No labels available"
                            : undefined
                      }
                    />

                    {formData.actions.length > 1 && (
                      <Tooltip content="Delete Action" position="left" color="primary">
                        <ActionButton
                          variant="outline"
                          className="justify-center cursor-pointer border-none bg-[var(--destructive)]/5 hover:bg-[var(--destructive)]/10 text-[var(--destructive)]"
                          onClick={() => removeAction(index)}
                        >
                          <HiTrash className="w-4 h-4" />
                        </ActionButton>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <ActionButton
                type="button"
                secondary
                onClick={() => {
                  setShowForm(false);
                  setEditingRule(null);
                  setFormData(defaultRule);
                }}
              >
                Cancel
              </ActionButton>
              <ActionButton onClick={handleSaveRule} disabled={saving} primary>
                {saving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
              </ActionButton>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingRule(null);
        }}
        onConfirm={handleDeleteRule}
        title="Delete Rule"
        message={`Are you sure you want to delete the rule "${
          deletingRule?.name || ""
        }"? This action cannot be undone.`}
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
