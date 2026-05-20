import ActionButton from "@/components/common/ActionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TrelloBoard, useTrelloSync } from "@/hooks/useTrelloSync";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Settings,
  X,
  ExternalLink as ExternalLinkIcon
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { FaTrello } from "react-icons/fa";
import { toast } from "sonner";
import ConfirmationModal from "../modals/ConfirmationModal";

interface TrelloWorkspaceSyncPanelProps {
  workspaceId: string;
}

type Step = "status" | "credentials" | "select_boards" | "importing" | "done";

function TrelloStepper({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-[var(--border)] z-0">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-500 ease-in-out"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
        {steps.map((label, index) => {
          const isCompleted = currentStep > index;
          const isCurrent = currentStep === index;
          return (
            <div key={label} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 border-2",
                  isCompleted ? "bg-[var(--primary)] text-[var(--background)] border-[var(--primary)] shadow-md"
                    : isCurrent ? "bg-[var(--primary)] text-[var(--background)] border-[var(--primary)] shadow-lg scale-110"
                      : "bg-[var(--muted)] text-[var(--primary)] border-[var(--border)]"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium mt-1.5 transition-colors duration-300 text-center px-1",
                  isCurrent ? "text-[var(--foreground)]" : isCompleted ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
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

export default function TrelloWorkspaceSyncPanel({ workspaceId }: TrelloWorkspaceSyncPanelProps) {
  const {
    getWorkspaceStatus,
    connectWorkspace,
    listWorkspaceBoards,
    importBoardsToWorkspace,
    disconnectWorkspace,
    updateWorkspaceConfig,
    getWorkspaceSyncedProjects,
    syncAllWorkspaceProjects,
    loading: trelloLoading,
  } = useTrelloSync();
  const { t } = useTranslation(["integrations", "common"]);

  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [step, setStep] = useState<Step>("status");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [syncedProjects, setSyncedProjects] = useState<any[]>([]);

  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const s = await getWorkspaceStatus(workspaceId);
      setSyncStatus(s);
      if (s) {
        const projects = await getWorkspaceSyncedProjects(workspaceId);
        setSyncedProjects(projects);
      }
    } catch (err) {
      console.error("Failed to refresh status:", err);
    } finally {
      setLoadingStatus(false);
    }
  }, [workspaceId, getWorkspaceStatus, getWorkspaceSyncedProjects]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleConnect = async () => {
    if (!apiKey.trim() || !token.trim()) {
      toast.error(t("trello.messages.credential_required", "API Key and Token are required"));
      return;
    }
    try {
      const status = await connectWorkspace(workspaceId, {
        trelloApiKey: apiKey.trim(),
        trelloToken: token.trim(),
      });
      setSyncStatus(status);
      toast.success(t("trello.messages.connected_success", "Successfully connected to Trello Workspace"));
      
      // Load boards automatically
      const fetchedBoards = await listWorkspaceBoards(workspaceId);
      setBoards(fetchedBoards);
      setStep("select_boards");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLoadBoards = async () => {
    try {
      const fetchedBoards = await listWorkspaceBoards(workspaceId);
      setBoards(fetchedBoards);
      setStep("select_boards");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleBoardSelection = (boardId: string) => {
    setSelectedBoards(prev => 
      prev.includes(boardId) ? prev.filter(id => id !== boardId) : [...prev, boardId]
    );
  };

  const handleImport = async () => {
    if (selectedBoards.length === 0) {
      toast.error(t("trello.messages.select_board_required", "Please select at least one board"));
      return;
    }
    setStep("importing");
    try {
      const result = await importBoardsToWorkspace(workspaceId, selectedBoards);
      toast.success(t("trello.messages.import_complete", { defaultValue: "Successfully imported {{count}} projects", count: result.importedProjectsCount }));
      setStep("done");
      setSelectedBoards([]);
    } catch (err: any) {
      toast.error(err.message);
      setStep("select_boards");
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnectModalOpen(false);
    try {
      await disconnectWorkspace(workspaceId);
      setSyncStatus(null);
      setStep("status");
      setApiKey(""); setToken(""); setBoards([]); setSelectedBoards([]);
      toast.success(t("trello.messages.disconnected_success", "Disconnected successfully"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateConfig = async () => {
    if (!apiKey.trim() || !token.trim()) {
      toast.error("API Key and Token are required");
      return;
    }
    try {
      const status = await updateWorkspaceConfig(workspaceId, {
        trelloApiKey: apiKey.trim(),
        trelloToken: token.trim(),
      });
      setSyncStatus(status);
      setIsEditMode(false);
      toast.success("Workspace Trello credentials updated successfully");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    try {
      const result = await syncAllWorkspaceProjects(workspaceId);
      toast.success(`Bulk sync complete: ${result.successCount}/${result.total} projects synced.`);
      refreshStatus();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsBulkSyncing(false);
    }
  };

  if (loadingStatus) {
    return (
      <Card className="border-none bg-[var(--card)]">
        <CardContent className="py-10 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </CardContent>
      </Card>
    );
  }

  const wizardSteps = [
    t("trello.workspace.steps.credentials", "Credentials"),
    t("trello.workspace.steps.select_boards", "Select Boards"),
    t("trello.workspace.steps.importing", "Importing"),
    t("trello.workspace.steps.done", "Done")
  ];
  const stepIndex = step === "credentials" ? 0 : step === "select_boards" ? 1 : step === "importing" ? 2 : step === "done" ? 3 : -1;

  if (step === "status") {
    return (
      <Card className="border-none bg-[var(--card)]">
        <CardHeader className="border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <FaTrello className="text-[var(--primary)]" size={24} />
            <div>
              <CardTitle className="text-md">{t("trello.workspace.title", "Workspace Trello Integration")}</CardTitle>
              <CardDescription>{t("trello.workspace.subtitle", "Bulk import boards, lists, and tasks from Trello")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {syncStatus ? (
            <div className="space-y-6">
              {/* Dashboard Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500 bg-emerald-500/10 py-1 px-3">
                    <CheckCircle size={14} className="mr-1.5" /> {t("trello.workspace.connected", "Connected")}
                  </Badge>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    API Key: <code className="bg-[var(--muted)] px-1 rounded">••••{syncStatus.hasApiKey ? "present" : "missing"}</code>
                  </span>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(!isEditMode)}
                    leftIcon={<Settings size={14} />}
                    className="h-9"
                  >
                    {isEditMode ? t("trello.workspace.cancel_editing", "Cancel Editing") : t("trello.workspace.update_credentials", "Update Credentials")}
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    onClick={handleBulkSync}
                    disabled={isBulkSyncing || syncedProjects.length === 0}
                    leftIcon={isBulkSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    className="h-9"
                  >
                    {t("trello.workspace.sync_all_projects", "Sync All Projects")}
                  </ActionButton>
                </div>
              </div>

              {/* Edit Credentials Form */}
              {isEditMode && (
                <div className="p-4 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/[0.02] space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="text-xs">{t("trello.workspace.new_api_key", "New Trello API Key")}</Label>
                      <div className="relative">
                        <Input 
                          type={showApiKey ? "text" : "password"} 
                          value={apiKey} 
                          onChange={e => setApiKey(e.target.value)}
                          placeholder="Leave blank to keep current"
                          className="pr-10 h-9"
                        />
                        <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                          {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">{t("trello.workspace.new_token", "New Trello Token")}</Label>
                      <div className="relative">
                        <Input 
                          type={showToken ? "text" : "password"} 
                          value={token} 
                          onChange={e => setToken(e.target.value)}
                          placeholder="Leave blank to keep current"
                          className="pr-10 h-9"
                        />
                        <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                          {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <ActionButton
                      primary
                      size="sm"
                      onClick={handleUpdateConfig}
                      disabled={trelloLoading || !apiKey || !token}
                      leftIcon={trelloLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    >
                      {trelloLoading ? t("updating", { ns: "common", defaultValue: "Updating..." }) : t("trello.workspace.save_new_credentials", "Save New Credentials")}
                    </ActionButton>
                  </div>
                </div>
              )}

              {/* Projects List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{t("trello.workspace.synced_projects", "Synced Projects")} ({syncedProjects.length})</h4>
                  <Button variant="ghost" size="sm" onClick={handleLoadBoards} className="text-xs h-7 gap-1.5">
                    <Plus size={14} /> {t("trello.workspace.import_boards", "Import Boards")}
                  </Button>
                </div>
                
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_120px_80px] items-center px-4 py-2 bg-[var(--muted)]/30 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)]">
                    <span>{t("trello.workspace.project_name", "Project Name")}</span>
                    <span className="text-center">{t("trello.workspace.last_sync", "Last Sync")}</span>
                    <span className="text-center">{t("trello.workspace.status", "Status")}</span>
                    <span className="text-right">{t("trello.workspace.action", "Action")}</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto divide-y divide-[var(--border)]">
                    {syncedProjects.length === 0 ? (
                      <div className="py-10 text-center text-sm text-[var(--muted-foreground)] italic">
                        {t("trello.workspace.no_projects_imported", "No projects imported yet.")}
                      </div>
                    ) : (
                      syncedProjects.map((p) => (
                        <div key={p.id} className="grid grid-cols-[1fr_120px_120px_80px] items-center px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{p.name}</div>
                            <div className="text-[10px] text-[var(--muted-foreground)] truncate font-mono opacity-70">
                              Board: {p.trelloBoardId}
                            </div>
                          </div>
                          <div className="text-[10px] text-center text-[var(--muted-foreground)]">
                            {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleDateString() : "Never"}
                          </div>
                          <div className="flex justify-center">
                            {p.lastSyncStatus === "SUCCESS" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] px-1.5 py-0">Success</Badge>
                            ) : p.lastSyncStatus === "FAILED" ? (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Failed</Badge>
                            ) : (
                              <span className="text-[9px] text-[var(--muted-foreground)]">Pending</span>
                            )}
                          </div>
                          <div className="flex justify-end">
                            <a 
                              href={`/projects/${p.slug}/settings?tab=integrations`} 
                              className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-all"
                              title="Go to project settings"
                            >
                              <ExternalLinkIcon size={14} />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex justify-end">
                <ActionButton
                  type="button"
                  variant="destructive"
                  onClick={() => setIsDisconnectModalOpen(true)}
                  disabled={trelloLoading}
                  leftIcon={trelloLoading ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                  className="ml-auto h-8"
                >
                  {t("trello.workspace.disconnect_workspace", "Disconnect Workspace")}
                </ActionButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center pt-2">
              <ActionButton primary size="lg" className="px-10" leftIcon={<FaTrello size={18} />} onClick={() => setStep("credentials")}>
                {t("trello.workspace.connect_account", "Connect Trello Account")}
              </ActionButton>
            </div>
          )}
        </CardContent>
        <ConfirmationModal
          isOpen={isDisconnectModalOpen}
          onClose={() => setIsDisconnectModalOpen(false)}
          onConfirm={handleDisconnect}
          title={t("trello.messages.disconnect_title", "Disconnect Trello")}
          message={t("trello.messages.disconnect_confirm", "Are you sure you want to disconnect? Projects already imported will not be deleted.")}
          confirmText={t("trello.disconnect", "Disconnect")}
          cancelText={t("cancel", { ns: "common", defaultValue: "Cancel" })}
          type="danger"
        />
      </Card>
    );
  }

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <FaTrello className="text-[var(--primary)]" size={24} />
          <div>
            <CardTitle className="text-md">{t("trello.workspace.bulk_import_title", "Bulk Import from Trello")}</CardTitle>
          </div>
        </div>
        <TrelloStepper currentStep={stepIndex} steps={wizardSteps} />
      </CardHeader>
      <CardContent className="pt-8 pb-8">
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
                onClick={handleConnect}
                disabled={trelloLoading || !apiKey || !token}
                className="px-8"
                rightIcon={trelloLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              >
                {t("trello.wizard.validate_continue", "Connect")}
              </ActionButton>
            </div>
          </div>
        )}

        {step === "select_boards" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <p className="text-sm text-[var(--muted-foreground)]">{t("trello.workspace.select_boards_desc", "Select the boards you want to import as new projects.")}</p>
            <div className="grid gap-2 max-h-96 overflow-y-auto pr-2">
              {boards.map(b => (
                <label
                  key={b.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-[var(--muted)]/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedBoards.includes(b.id)}
                    onCheckedChange={() => toggleBoardSelection(b.id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{b.name}</div>
                    {b.desc && <div className="text-xs text-[var(--muted-foreground)] truncate">{b.desc}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between">
              <ActionButton variant="outline" onClick={() => setStep("status")}>{t("cancel", { ns: "common", defaultValue: "Cancel" })}</ActionButton>
              <ActionButton primary onClick={handleImport} disabled={trelloLoading || selectedBoards.length === 0}>
                {t("trello.workspace.import_selected", "Import Selected ({{count}})", { count: selectedBoards.length })}
              </ActionButton>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-10">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
            <p>{t("trello.workspace.importing_wait", "Importing boards, please wait...")}</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-10">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle size={24} />
            </div>
            <h3 className="text-lg font-semibold">{t("trello.workspace.import_complete", "Import Complete!")}</h3>
            <p className="text-[var(--muted-foreground)] text-sm">{t("trello.workspace.import_complete_desc", "Your boards have been imported as new projects.")}</p>
            <ActionButton primary onClick={() => setStep("status")}>{t("trello.workspace.back_to_settings", "Back to Settings")}</ActionButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
