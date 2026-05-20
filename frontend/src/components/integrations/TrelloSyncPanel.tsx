import ActionButton from "@/components/common/ActionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProject } from "@/contexts/project-context";
import { TrelloBoard, TrelloList, TrelloSyncStatus, useTrelloSync } from "@/hooks/useTrelloSync";
import { cn } from "@/lib/utils";
import { TaskStatus } from "@/types";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  RefreshCw,
  Settings,
  X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { FaTrello } from "react-icons/fa";
import { toast } from "sonner";
import ConfirmationModal from "../modals/ConfirmationModal";


// ─────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────

interface TrelloSyncPanelProps {
  projectId: string;
  projectStatuses?: TaskStatus[];
}

type Step = "status" | "credentials" | "board" | "mapping" | "done";

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────
function formatRelative(date: string | Date | null) {
  if (!date) return "Never";
  const now = Date.now();
  const target = new Date(date).getTime();
  const isFuture = target > now;
  const diff = Math.abs(now - target);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return isFuture ? "Soon" : "Just now";

  const value = minutes < 60
    ? `${minutes}m`
    : Math.floor(minutes / 60) < 24
      ? `${Math.floor(minutes / 60)}h`
      : `${Math.floor(minutes / 1440)}d`;

  return isFuture ? `In ${value}` : `${value} ago`;
}

// ─────────────────────────────────────────────────────────────────
//  Step indicator (Generic Version)
// ─────────────────────────────────────────────────────────────────
function TrelloStepper({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-[var(--border)] z-0">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-500 ease-in-out"
            style={{
              width: `${(currentStep / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Step Items */}
        {steps.map((label, index) => {
          const isCompleted = currentStep > index;
          const isCurrent = currentStep === index;

          return (
            <div
              key={label}
              className="flex flex-col items-center relative z-10"
              style={{ flex: 1 }}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 border-2",
                  isCompleted
                    ? "bg-[var(--primary)] text-[var(--background)] border-[var(--primary)] shadow-md"
                    : isCurrent
                      ? "bg-[var(--primary)] text-[var(--background)] border-[var(--primary)] shadow-lg scale-110"
                      : "bg-[var(--muted)] text-[var(--primary)] border-[var(--border)]"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium mt-1.5 transition-colors duration-300 text-center px-1",
                  isCurrent
                    ? "text-[var(--foreground)]"
                    : isCompleted
                      ? "text-[var(--primary)]"
                      : "text-[var(--muted-foreground)]"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Main Panel
// ─────────────────────────────────────────────────────────────────
export default function TrelloSyncPanel({ projectId, projectStatuses = [] }: TrelloSyncPanelProps) {
  const {
    getStatus,
    validateAndListBoards,
    validateAndListLists,
    connect,
    triggerSync,
    updateConfig,
    disconnect,
    listLists,
    loading: trelloLoading,
    error: trelloError
  } = useTrelloSync();
  const { t } = useTranslation(["integrations", "common"]);
  const { getTaskStatusByProject } = useProject();

  // Internal statuses state if not provided via props
  const [internalStatuses, setInternalStatuses] = useState<TaskStatus[]>([]);

  // Connection state
  const [syncStatus, setSyncStatus] = useState<TrelloSyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Setup wizard state
  const [step, setStep] = useState<Step>("status");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [trelloLists, setTrelloLists] = useState<TrelloList[]>([]);
  const [statusMappings, setStatusMappings] = useState<Record<string, string>>({});
  const [syncInterval, setSyncInterval] = useState(15);

  // Connected panel state
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editingMappings, setEditingMappings] = useState<Record<string, string>>({});
  const [editingInterval, setEditingInterval] = useState(15);
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Load & Refresh status ──
  const refreshStatus = useCallback(async (showLoading = true) => {
    let mounted = true;
    if (showLoading) setLoadingStatus(true);
    else setRefreshing(true);

    try {
      const s = await getStatus(projectId);
      if (mounted) setSyncStatus(s);
    } catch (err) {
      console.error("Failed to refresh status:", err);
    } finally {
      if (mounted) {
        setLoadingStatus(false);
        setRefreshing(false);
      }
    }
    return () => { mounted = false; };
  }, [projectId, getStatus]);

  useEffect(() => {
    refreshStatus(true);
  }, [refreshStatus]);

  // ── Fetch project statuses if not provided ──
  useEffect(() => {
    if (projectStatuses.length === 0 && projectId) {
      getTaskStatusByProject(projectId)
        .then((data) => {
          setInternalStatuses(data || []);
        })
        .catch((err) => {
          console.error("Failed to fetch project statuses:", err);
        });
    }
  }, [projectId, projectStatuses.length, getTaskStatusByProject]);

  const activeStatuses = projectStatuses.length > 0 ? projectStatuses : internalStatuses;

  // ── Wizard: validate credentials & fetch boards ──
  const handleValidateCredentials = async () => {
    if (!apiKey.trim() || !token.trim()) {
      toast.error(t("trello.messages.credential_required"));
      return;
    }
    try {
      const data = await validateAndListBoards(apiKey.trim(), token.trim());
      setBoards(data);
      setStep("board");
      toast.success(t("trello.messages.found_boards", { count: data.length }));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Wizard: fetch lists for selected board ──
  const handleSelectBoard = async () => {
    if (!selectedBoard) { toast.error(t("trello.messages.select_board_required")); return; }
    try {
      const lists = await validateAndListLists(selectedBoard, apiKey.trim(), token.trim());
      setTrelloLists(lists);
      // Initialise mappings to empty
      const init: Record<string, string> = {};
      lists.forEach((l) => { init[l.id] = ""; });
      setStatusMappings(init);
      setStep("mapping");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Wizard: save connection ──
  const handleConnect = async () => {
    try {
      const status = await connect({
        projectId,
        trelloBoardId: selectedBoard,
        trelloApiKey: apiKey.trim(),
        trelloToken: token.trim(),
        syncInterval,
        statusMappings: Object.fromEntries(
          Object.entries(statusMappings).filter(([, v]) => v && v !== "none"),
        ),
      });
      setSyncStatus(status);
      setStep("done");
      toast.success(t("trello.messages.connected_success"));
      // Trigger first sync automatically
      await handleSync(status.projectId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Trigger manual sync ──
  const handleSync = async (pid?: string) => {
    setSyncing(true);
    try {
      const result = await triggerSync(pid || projectId);
      const refreshed = await getStatus(pid || projectId);
      setSyncStatus(refreshed);
      toast.success(t("trello.messages.sync_complete", { count: result.cardsProcessed, duration: result.durationMs }));
    } catch (err: any) {
      toast.error(t("trello.messages.sync_failed", { message: err.message }));
    } finally {
      setSyncing(false);
    }
  };

  // ── Toggle sync enabled ──
  const handleToggleEnabled = async () => {
    if (!syncStatus) return;
    try {
      const updated = await updateConfig(projectId, {
        syncEnabled: !syncStatus.syncEnabled,
      });
      setSyncStatus(updated);
      toast.success(updated.syncEnabled ? t("trello.messages.auto_sync_enabled") : t("trello.messages.auto_sync_paused"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Disconnect ──
  const handleDisconnect = async () => {
    setIsDisconnectModalOpen(false);
    setDisconnecting(true);
    try {
      await disconnect(projectId);
      setSyncStatus(null);
      setStep("status");
      setApiKey(""); setToken(""); setSelectedBoard(""); setBoards([]); setTrelloLists([]);
      toast.success(t("trello.messages.disconnected_success"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Handle Edit Config ──
  const handleStartEdit = async () => {
    if (!syncStatus) return;
    setIsEditing(true);
    setEditingInterval(syncStatus.syncInterval);
    setEditingMappings(syncStatus.statusMappings || {});
    
    try {
      const lists = await listLists(projectId);
      setTrelloLists(lists);
    } catch (err: any) {
      toast.error(t("trello.messages.failed_to_fetch_lists", "Failed to fetch Trello lists"));
      setIsEditing(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = await updateConfig(projectId, {
        syncInterval: editingInterval,
        statusMappings: Object.fromEntries(
          Object.entries(editingMappings).filter(([, v]) => v && v !== "none"),
        ),
      });
      setSyncStatus(updated);
      setIsEditing(false);
      toast.success(t("trello.messages.config_updated", "Configuration updated successfully"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  //  Loading skeleton
  // ─────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────
  //  Loading skeleton
  // ─────────────────────────────────────────────────────────────────
  if (loadingStatus) {
    return (
      <Card className="border-none bg-[var(--card)]">
        <CardHeader className="border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <FaTrello className="text-[var(--primary)]" size={24} />
            <div>
              <CardTitle className="text-md">{t("trello.title")}</CardTitle>
              <CardDescription>{t("trello.loading_status", "Loading sync status…")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-10 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--muted-foreground)]">{t("trello.fetching_data")}</p>
        </CardContent>
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  //  Connected view
  // ─────────────────────────────────────────────────────────────────
  if (syncStatus) {
    return (
      <>
        <Card className="border-none bg-[var(--card)]">
          <CardHeader className="border-b border-[var(--border)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaTrello className="text-[var(--primary)]" size={24} />
                <div>
                  <CardTitle className="text-md">{t("trello.title")}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5">
                    {t("trello.connected_to", "Connected to board")}{" "}
                    <code className="px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)] text-[10px] font-mono">
                      {syncStatus.trelloBoardId}
                    </code>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 rounded-full", refreshing && "bg-[var(--muted)]")}
                  onClick={() => refreshStatus(false)}
                  disabled={refreshing}
                  title={t("refresh", { ns: "common", defaultValue: "Refresh" })}
                >
                  <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
                </Button>
                <Badge
                  variant="outline"
                  className="w-fit gap-1.5 py-1 px-3 border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                >
                  <CheckCircle size={12} /> {t("trello.connected")}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Status Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t("trello.last_sync"), value: formatRelative(syncStatus.lastSyncAt) },
                {
                  label: t("trello.next_sync"),
                  value: syncStatus.syncEnabled && syncStatus.lastSyncAt
                    ? formatRelative(new Date(new Date(syncStatus.lastSyncAt).getTime() + syncStatus.syncInterval * 60 * 1000))
                    : "—",
                  className: "hidden md:flex"
                },
                {
                  label: t("trello.status"),
                  value: (
                    <Badge
                      variant={syncStatus.lastSyncStatus === "SUCCESS" ? "default" : "destructive"}
                      className={cn(
                        "text-[10px] h-5",
                        syncStatus.lastSyncStatus === "SUCCESS" && "bg-emerald-500 hover:bg-emerald-600 border-none"
                      )}
                    >
                      {syncStatus.lastSyncStatus === "SUCCESS" ? "✓ " + t("trello.synced") : "✗ " + t("trello.failed")}
                    </Badge>
                  ),
                },
                { label: t("trello.cards_imported"), value: syncStatus.cardsImported },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 flex flex-col gap-1",
                    stat.className
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                    {stat.label}
                  </span>
                  <span className="text-sm font-bold text-[var(--foreground)]">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Error display */}
            {syncStatus.lastSyncError && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{syncStatus.lastSyncError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleSync()}
                disabled={syncing}
                className="gap-2"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {syncing ? t("trello.syncing") : t("trello.sync_now")}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleStartEdit}
                disabled={syncing || refreshing}
                className="gap-2"
              >
                <Settings size={14} />
                {t("trello.edit_config", "Settings")}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleEnabled}
                className={cn(
                  "gap-2",
                  syncStatus.syncEnabled
                    ? "text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600"
                    : "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600"
                )}
              >
                <Clock size={14} />
                {syncStatus.syncEnabled ? t("trello.pause_auto_sync") : t("trello.resume_auto_sync")}
              </Button>

              <ActionButton
                type="button"
                variant="destructive"
                onClick={() => setIsDisconnectModalOpen(true)}
                disabled={disconnecting}
                leftIcon={disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                className="ml-auto h-8"
              >
                {t("trello.disconnect")}
              </ActionButton>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]/70 italic border-t border-[var(--border)] pt-4">
              <Trans
                t={t}
                i18nKey="trello.footer_note"
                values={{ interval: syncStatus.syncInterval }}
                components={{ strong: <strong className="text-[var(--foreground)] font-semibold" /> }}
              >
                Auto-sync runs every <strong>{syncStatus.syncInterval} min</strong>
                {syncStatus.syncEnabled ? " — active" : " — paused"}.
                Tasks synced from Trello will have a Trello Card ID for deduplication.
              </Trans>
            </p>
          </CardContent>
        </Card>

        {/* Edit Configuration Overlay/Form */}
        {isEditing && (
          <Card className="mt-4 border-[var(--primary)]/30 bg-[var(--primary)]/[0.02] shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <CardHeader className="py-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Settings size={16} className="text-[var(--primary)]" />
                  {t("trello.edit_config_title", "Edit Sync Configuration")}
                </CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                <X size={16} />
              </Button>
            </CardHeader>
            <CardContent className="py-6 space-y-6">
              {/* Interval Selection */}
              <div className="grid gap-2 max-w-xs">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("trello.wizard.sync_interval_label")}
                </Label>
                <Select
                  value={String(editingInterval)}
                  onValueChange={(v) => setEditingInterval(Number(v))}
                >
                  <SelectTrigger className="w-full bg-[var(--background)] border-[var(--border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--card)] border border-[var(--border)] shadow-xl">
                    {[5, 15, 30, 60].map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {t("minutes", { ns: "common", count: v })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Mappings */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("trello.wizard.map_lists")}
                </Label>
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="grid grid-cols-2 items-center px-6 py-2 bg-[var(--muted)]/30 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)]">
                    <span>{t("trello.wizard.trello_list")}</span>
                    <span>{t("trello.wizard.taskosaur_status")}</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {trelloLists.map((list) => (
                      <div
                        key={list.id}
                        className="grid grid-cols-2 items-center px-6 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--primary)]/[0.01] transition-colors"
                      >
                        <span className="text-xs font-medium">{list.name}</span>
                        <Select
                          value={editingMappings[list.id] || "none"}
                          onValueChange={(v) => setEditingMappings(prev => ({ ...prev, [list.id]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs bg-[var(--background)] border-[var(--border)]">
                            <SelectValue placeholder={t("trello.wizard.default_status")} />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--card)] border border-[var(--border)] shadow-xl">
                            <SelectItem value="none" className="text-[var(--muted-foreground)] italic">
                              {t("trello.wizard.default_status")}
                            </SelectItem>
                            {activeStatuses.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <ActionButton variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={savingConfig}>
                  {t("cancel", { ns: "common", defaultValue: "Cancel" })}
                </ActionButton>
                <ActionButton
                  primary
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  leftIcon={savingConfig ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                >
                  {t("save", { ns: "common", defaultValue: "Save Changes" })}
                </ActionButton>
              </div>
            </CardContent>
          </Card>
        )}

        <ConfirmationModal
          isOpen={isDisconnectModalOpen}
          onClose={() => setIsDisconnectModalOpen(false)}
          onConfirm={handleDisconnect}
          title={t("trello.messages.disconnect_title")}
          message={t("trello.messages.disconnect_confirm")}
          confirmText={t("trello.disconnect")}
          cancelText={t("cancel", { ns: "common", defaultValue: "Cancel" })}
          type="danger"
        />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  //  Setup Wizard
  // ─────────────────────────────────────────────────────────────────
  const wizardSteps = [
    t("trello.wizard.credentials"),
    t("trello.wizard.choose_board"),
    t("trello.wizard.map_lists")
  ];
  const stepIndex = step === "credentials" ? 0 : step === "board" ? 1 : step === "mapping" || step === "done" ? 2 : -1;

  if (step === "status") {
    // Landing
    return (
      <Card className="border-none bg-[var(--card)]">
        <CardHeader className="border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <FaTrello className="text-[var(--primary)]" size={24} />
            <div>
              <CardTitle className="text-md">{t("trello.title")}</CardTitle>
              <CardDescription>{t("trello.subtitle")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
            {[
              t("trello.features.import_cards"),
              t("trello.features.map_lists"),
              t("trello.features.auto_sync"),
              t("trello.features.archived"),
              t("trello.features.per_user"),
            ].map((f) => (
              <div
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/30"
                key={f}
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-emerald-500" />
                </div>
                <span className="text-xs font-medium text-[var(--muted-foreground)]">{f}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center pt-6 border-t border-[var(--border)]">
            <ActionButton
              primary
              size="lg"
              className="px-10"
              leftIcon={<FaTrello size={18} />}
              onClick={() => setStep("credentials")}
            >
              {t("trello.connect_btn")}
            </ActionButton>
            <p className="mt-3 text-[10px] text-[var(--muted-foreground)]">
              {t("trello.wizard.info_title").replace(/<\/?strong>/g, "")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <FaTrello className="text-[var(--primary)]" size={24} />
          <div>
            <CardTitle className="text-md">{t("trello.wizard.connect_title")}</CardTitle>
            <CardDescription>{t("trello.wizard.connect_subtitle")}</CardDescription>
          </div>
        </div>
        <TrelloStepper currentStep={stepIndex} steps={wizardSteps} />
      </CardHeader>

      <CardContent className="pt-8 pb-8">
        {/* ── Step: Credentials ── */}
        {step === "credentials" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="p-4 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/10 space-y-3">
              <div className="flex items-center gap-2 text-[var(--primary)] font-semibold text-sm">
                <AlertCircle size={16} />
                <span>{t("trello.wizard.prerequisites")}</span>
              </div>
              <ol className="space-y-2 text-sm text-[var(--muted-foreground)] list-decimal ml-4">
                <li>
                  <Trans t={t} i18nKey="trello.wizard.guide_step_1" components={{ 1: <a href="https://trello.com/power-ups/admin" target="_blank" rel="noreferrer" className="text-[var(--primary)] font-medium hover:underline inline-flex items-center gap-1" /> }}>
                    Go to <a>trello.com/power-ups/admin <ExternalLink size={12} /></a> and create a Power-Up to get your API Key.
                  </Trans>
                </li>
                <li>
                  <div className="space-y-1">
                    <p>{t("trello.wizard.guide_step_2_intro", "Generate a Token using your API Key:")}</p>
                    {apiKey.trim() ? (
                      <ActionButton
                        primary
                        size="sm"
                        className="h-8 text-[10px] px-4"
                        leftIcon={<ExternalLink size={12} />}
                        onClick={() => window.open(`https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=${apiKey.trim()}&name=Taskosaur`, '_blank')}
                      >
                        {t("trello.wizard.get_token_btn")}
                      </ActionButton>
                    ) : (
                      <div className="text-[10px] text-[var(--muted-foreground)] px-2 py-1 rounded bg-[var(--muted)]/50 border border-dashed border-[var(--border)]">
                        {t("trello.wizard.enter_key_hint")}
                      </div>
                    )}
                  </div>
                </li>
              </ol>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="trello-api-key">{t("trello.wizard.api_key_label")}</Label>
                <div className="relative">
                  <Input
                    id="trello-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t("trello.wizard.api_key_placeholder")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)]">
                  <Trans
                    t={t}
                    i18nKey="trello.wizard.api_key_hint"
                    components={{
                      1: (
                        <a
                          href="https://trello.com/app-key"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--primary)] hover:underline"
                        />
                      ),
                    }}
                  >
                    Your API Key can be found in the <a>Trello Power-Up Admin</a>.
                  </Trans>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="trello-token">{t("trello.wizard.token_label")}</Label>
                <div className="relative">
                  <Input
                    id="trello-token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={t("trello.wizard.token_placeholder")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                  <RefreshCw size={10} /> {t("trello.wizard.encryption_hint")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-[var(--border)]">
              <ActionButton
                variant="outline"
                onClick={() => setStep("status")}
                className="px-6"
              >
                {t("cancel", { ns: "common", defaultValue: "Cancel" })}
              </ActionButton>
              <ActionButton
                primary
                onClick={handleValidateCredentials}
                disabled={trelloLoading || !apiKey || !token}
                className="px-8"
                rightIcon={trelloLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              >
                {t("trello.wizard.validate_continue")}
              </ActionButton>
            </div>
          </div>
        )}

        {/* ── Step: Board ── */}
        {step === "board" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <p className="text-sm text-[var(--muted-foreground)]">{t("trello.wizard.select_board_desc")}</p>

            <div className="grid gap-2">
              {boards.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBoard(b.id)}
                  className={cn(
                    "relative p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                    selectedBoard === b.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/[0.03] ring-1 ring-[var(--primary)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/[0.01]"
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                      selectedBoard === b.id
                        ? "border-[var(--primary)] bg-[var(--primary)] shadow-[0_0_0_2px_rgba(var(--primary-rgb),0.1)]"
                        : "border-[var(--border)] bg-transparent group-hover:border-[var(--primary)]/50"
                    )}>
                      {selectedBoard === b.id && (
                        <div className="w-2 h-2 rounded-full bg-white shadow-sm animate-in zoom-in-50 duration-200" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        "text-sm font-semibold truncate transition-colors",
                        selectedBoard === b.id ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                      )}>
                        {b.name}
                      </div>
                      {b.desc && (
                        <div className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 mt-0.5 opacity-80">
                          {b.desc}
                        </div>
                      )}
                    </div>
                  </div>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 ml-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              ))}
            </div>

            <div className="grid gap-2 max-w-xs">
              <Label>{t("trello.wizard.sync_interval_label")}</Label>
              <Select
                value={String(syncInterval)}
                onValueChange={(v) => setSyncInterval(Number(v))}
              >
                <SelectTrigger className="w-full bg-[var(--background)] border-[var(--border)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--card)] border border-[var(--border)] shadow-xl">
                  {[5, 15, 30, 60].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {t("minutes", { ns: "common", count: v })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-[var(--border)]">
              <ActionButton
                variant="outline"
                onClick={() => setStep("credentials")}
                className="px-6"
              >
                {t("back", { ns: "common", defaultValue: "Back" })}
              </ActionButton>
              <ActionButton
                primary
                onClick={handleSelectBoard}
                disabled={!selectedBoard || trelloLoading}
                className="px-8"
                rightIcon={trelloLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              >
                {t("trello.wizard.configure_mappings")}
              </ActionButton>
            </div>
          </div>
        )}

        {/* ── Step: List → Status Mapping ── */}
        {step === "mapping" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <p className="text-sm text-[var(--muted-foreground)]">{t("trello.wizard.mapping_desc")}</p>

            <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 items-center px-6 py-3 bg-[var(--muted)]/30 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <FaTrello className="text-[#0079BF]" size={14} />
                  <span>{t("trello.wizard.trello_list")}</span>
                </div>
                <div className="flex items-center gap-2 pl-6 border-l border-[var(--border)]">
                  <div className="w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center text-white scale-75">
                    <Check size={10} />
                  </div>
                  <span>{t("trello.wizard.taskosaur_status")}</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {trelloLists.map((list) => (
                  <div key={list.id} className="grid grid-cols-2 items-center px-6 py-4 bg-[var(--background)] hover:bg-[var(--muted)]/[0.02] transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0079BF]/30 group-hover:bg-[#0079BF]/60 transition-colors" />
                      <span className="text-sm font-semibold text-[var(--foreground)] truncate pr-4">
                        {list.name}
                      </span>
                    </div>
                    <div className="pl-6 border-l border-[var(--border)]/50 group-hover:border-[var(--primary)]/30 transition-colors">
                      <Select
                        value={statusMappings[list.id] || "none"}
                        onValueChange={(v) => setStatusMappings((prev) => ({ ...prev, [list.id]: v }))}
                      >
                        <SelectTrigger size="sm" className="w-full h-9 bg-[var(--background)] border-[var(--border)] hover:border-[var(--primary)]/30 transition-colors">
                          <SelectValue placeholder={t("trello.wizard.default_status")} />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--card)] border border-[var(--border)] shadow-xl">
                          <SelectItem value="none">{t("trello.wizard.default_status")}</SelectItem>
                          {activeStatuses.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-[var(--border)]">
              <ActionButton
                variant="outline"
                onClick={() => setStep("board")}
                className="px-6"
              >
                {t("back", { ns: "common", defaultValue: "Back" })}
              </ActionButton>
              <ActionButton
                primary
                onClick={handleConnect}
                disabled={trelloLoading}
                className="px-8"
                rightIcon={trelloLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              >
                {t("trello.wizard.connect_start")}
              </ActionButton>
            </div>
          </div>
        )}
      </CardContent>

      {trelloError && (
        <div className="m-6 flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{trelloError}</span>
        </div>
      )}
    </Card>
  );
}
