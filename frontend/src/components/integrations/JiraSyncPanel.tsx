import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check, CheckCircle, Clock, Eye, EyeOff, Loader2, Plug, RefreshCw, Settings, X } from "lucide-react";
import { SiJira } from "react-icons/si";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/project-context";
import { JiraProject, JiraStatus, JiraSyncStatus, useJiraSync } from "@/hooks/useJiraSync";
import { TaskStatus } from "@/types";
import ConfirmationModal from "../modals/ConfirmationModal";
import ActionButton from "@/components/common/ActionButton";
import { useTranslation } from "react-i18next";

interface Props { projectId: string; projectStatuses?: TaskStatus[]; }
type Step = "status" | "credentials" | "project" | "mapping" | "done";

function formatRelative(date: string | Date | null) {
  if (!date) return "Never";
  const diff = Math.abs(Date.now() - new Date(date).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m/60)}h ago`;
  return `${Math.floor(m/1440)}d ago`;
}

function Stepper({ step }: { step: number }) {
  const { t } = useTranslation("integrations");
  const steps = [
    t("jira.step_credentials", "Credentials"),
    t("jira.step_project", "Project"),
    t("jira.step_mapping", "Map Statuses")
  ];
  return (
    <div className="flex items-center justify-between mt-6 relative">
      <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-[var(--border)] z-0">
        <div className="h-full bg-[var(--primary)] transition-all duration-500" style={{ width: `${(step / (steps.length - 1)) * 100}%` }} />
      </div>
      {steps.map((label, i) => (
        <div key={label} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all", step > i ? "bg-[var(--primary)] text-white border-[var(--primary)]" : step === i ? "bg-[var(--primary)] text-white border-[var(--primary)] scale-110" : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]")}>
            {step > i ? <Check size={14} /> : i + 1}
          </div>
          <span className={cn("text-[10px] mt-1.5 text-center", step === i ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function JiraSyncPanel({ projectId, projectStatuses = [] }: Props) {
  const { t } = useTranslation("integrations");
  const { getStatus, validateAndListProjects, validateAndListStatuses, connect, triggerSync, updateConfig, disconnect, listStatuses } = useJiraSync();
  const { getTaskStatusByProject } = useProject();

  const [syncStatus, setSyncStatus] = useState<JiraSyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [step, setStep] = useState<Step>("status");
  const [siteUrl, setSiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [jiraStatuses, setJiraStatuses] = useState<JiraStatus[]>([]);
  const [statusMappings, setStatusMappings] = useState<Record<string, string>>({});
  const [syncInterval, setSyncInterval] = useState<number | "">(15);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMappings, setEditMappings] = useState<Record<string, string>>({});
  const [editInterval, setEditInterval] = useState<number | "">(15);
  const [saving, setSaving] = useState(false);
  const [internalStatuses, setInternalStatuses] = useState<TaskStatus[]>([]);

  const activeStatuses = projectStatuses.length > 0 ? projectStatuses : internalStatuses;

  const refreshStatus = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingStatus(true); else setRefreshing(true);
    try { const s = await getStatus(projectId); setSyncStatus(s); }
    catch { /* silent */ }
    finally { setLoadingStatus(false); setRefreshing(false); }
  }, [projectId, getStatus]);

  useEffect(() => { refreshStatus(true); }, [refreshStatus]);

  useEffect(() => {
    if (projectStatuses.length === 0 && projectId) {
      getTaskStatusByProject(projectId).then(d => setInternalStatuses(d || [])).catch(() => {});
    }
  }, [projectId, projectStatuses.length, getTaskStatusByProject]);

  const handleValidate = async () => {
    if (!siteUrl.trim() || !email.trim() || !apiToken.trim()) { toast.error("All fields are required"); return; }
    setConnecting(true);
    try {
      const data = await validateAndListProjects(siteUrl.trim(), email.trim(), apiToken.trim());
      setJiraProjects(data); setStep("project");
      toast.success(`Found ${data.length} Jira project(s)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setConnecting(false); }
  };

  const handleSelectProject = async () => {
    if (!selectedProject) { toast.error("Select a project"); return; }
    setConnecting(true);
    try {
      const statuses = await validateAndListStatuses(siteUrl.trim(), selectedProject, email.trim(), apiToken.trim());
      setJiraStatuses(statuses);
      const init: Record<string, string> = {};
      statuses.forEach(s => { init[s.id] = ""; });
      setStatusMappings(init); setStep("mapping");
    } catch (e: any) { toast.error(e.message); }
    finally { setConnecting(false); }
  };

  const handleConnect = async () => {
    const intervalNum = Number(syncInterval);
    if (!syncInterval || isNaN(intervalNum) || intervalNum < 5) {
      toast.error(t("jira.interval_error_min", "Sync interval must be at least 5 minutes"));
      return;
    }
    if (intervalNum > 1440) {
      toast.error(t("jira.interval_error_max", "Sync interval cannot exceed 1440 minutes (24 hours)"));
      return;
    }
    const normalizedSiteUrl = siteUrl.trim();
    setConnecting(true);
    try {
      const s = await connect({ projectId, jiraSiteUrl: normalizedSiteUrl, jiraProjectKey: selectedProject, jiraEmail: email.trim(), jiraApiToken: apiToken.trim(), syncInterval: intervalNum, statusMappings: Object.fromEntries(Object.entries(statusMappings).filter(([, v]) => v && v !== "none")) });
      setSyncStatus(s); setStep("done");
      toast.success("Jira connected successfully!");
      setSyncing(true);
      try { const r = await triggerSync(s.projectId!); toast.success(`Synced ${r.issuesProcessed} issues`); } catch {}
      finally { setSyncing(false); }
      await refreshStatus(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setConnecting(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try { const r = await triggerSync(projectId); await refreshStatus(false); toast.success(`Synced ${r.issuesProcessed} issues in ${r.durationMs}ms`); }
    catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  const handleToggle = async () => {
    if (!syncStatus) return;
    try { const u = await updateConfig(projectId, { syncEnabled: !syncStatus.syncEnabled }); setSyncStatus(u); toast.success(u.syncEnabled ? "Auto-sync enabled" : "Auto-sync paused"); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDisconnect = async () => {
    setConfirmOpen(false); setDisconnecting(true);
    try { await disconnect(projectId); setSyncStatus(null); setStep("status"); setEmail(""); setApiToken(""); setSiteUrl(""); toast.success("Jira disconnected"); }
    catch (e: any) { toast.error(e.message); }
    finally { setDisconnecting(false); }
  };

  const handleStartEdit = async () => {
    if (!syncStatus) return;
    setIsEditing(true); setEditInterval(syncStatus.syncInterval); setEditMappings(syncStatus.statusMappings || {});
    try { const s = await listStatuses(projectId); setJiraStatuses(s); }
    catch { toast.error("Failed to load statuses"); setIsEditing(false); }
  };

  const handleSaveEdit = async () => {
    const intervalNum = Number(editInterval);
    if (!editInterval || isNaN(intervalNum) || intervalNum < 5) {
      toast.error(t("jira.interval_error_min", "Sync interval must be at least 5 minutes"));
      return;
    }
    if (intervalNum > 1440) {
      toast.error(t("jira.interval_error_max", "Sync interval cannot exceed 1440 minutes (24 hours)"));
      return;
    }
    setSaving(true);
    try { const u = await updateConfig(projectId, { syncInterval: intervalNum, statusMappings: Object.fromEntries(Object.entries(editMappings).filter(([, v]) => v && v !== "none")) }); setSyncStatus(u); setIsEditing(false); toast.success("Config updated"); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loadingStatus) return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center gap-3"><SiJira className="text-[#0052CC]" size={24} /><CardTitle className="text-md">{t("jira.title", "Jira Sync")}</CardTitle></div>
      </CardHeader>
      <CardContent className="py-10 flex flex-col items-center gap-4"><Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" /><p className="text-sm text-[var(--muted-foreground)]">{t("trello.loading_status", "Loading sync status...")}</p></CardContent>
    </Card>
  );

  if (syncStatus) return (
    <>
      <Card className="border-none bg-[var(--card)]">
        <CardHeader className="border-b border-[var(--border)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SiJira className="text-[#0052CC]" size={24} />
              <div><CardTitle className="text-md">{t("jira.title", "Jira Sync")}</CardTitle><CardDescription>{t("jira.connected_to", "Connected to")}<Badge variant="outline" className="font-mono text-[10px] border-[var(--border)] bg-transparent text-[var(--muted-foreground)] ml-1.5">{syncStatus.jiraProjectKey}</Badge></CardDescription></div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => refreshStatus(false)} disabled={refreshing}><RefreshCw size={14} className={cn(refreshing && "animate-spin")} /></Button>
              <Badge variant="outline" className="gap-1.5 py-1 px-3 border-emerald-500/30 text-emerald-500 bg-emerald-500/5"><CheckCircle size={12} /> {t("jira.connected", "Connected")}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t("jira.last_sync", "Last Sync"), value: formatRelative(syncStatus.lastSyncAt) },
              { label: t("trello.next_sync", "Next Sync"), value: syncStatus.syncEnabled && syncStatus.lastSyncAt ? formatRelative(new Date(new Date(syncStatus.lastSyncAt).getTime() + syncStatus.syncInterval * 60000)) : "—" },
              { label: t("jira.status", "Status"), value: <Badge variant={syncStatus.lastSyncStatus === "SUCCESS" ? "default" : "destructive"} className={cn("text-[10px] h-5", syncStatus.lastSyncStatus === "SUCCESS" && "bg-emerald-500 hover:bg-emerald-600 border-none")}>{syncStatus.lastSyncStatus === "SUCCESS" ? `✓ ${t("trello.synced", "Synced")}` : `✗ ${t("trello.failed", "Failed")}`}</Badge> },
              { label: t("trello.cards_imported", "Issues Imported").replace("Cards", "Issues").replace("cartões", "problemas").replace("Cartes", "tickets"), value: syncStatus.issuesImported },
            ].map(stat => (
              <div key={stat.label} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">{stat.label}</span>
                <span className="text-sm font-bold text-[var(--foreground)]">{stat.value}</span>
              </div>
            ))}
          </div>
          {syncStatus.lastSyncError && <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs"><AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{syncStatus.lastSyncError}</span></div>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-2">{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}{syncing ? t("trello.syncing", "Syncing...") : t("trello.sync_now", "Sync Now")}</Button>
            <Button size="sm" variant="outline" onClick={handleStartEdit} className="gap-2"><Settings size={14} />{t("jira.step_mapping", "Settings")}</Button>
            <Button size="sm" variant="outline" onClick={handleToggle} className={cn("gap-2", syncStatus.syncEnabled ? "text-amber-500 border-amber-500/30" : "text-emerald-500 border-emerald-500/30")}><Clock size={14} />{syncStatus.syncEnabled ? t("trello.pause_auto_sync", "Pause Auto-Sync") : t("trello.resume_auto_sync", "Resume Auto-Sync")}</Button>
            <ActionButton
              type="button"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={disconnecting}
              leftIcon={disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              className="ml-auto h-8"
            >
              {t("jira.disconnect", "Disconnect")}
            </ActionButton>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]/70 italic border-t border-[var(--border)] pt-4">{t("jira.footer_note", "Auto-sync runs every {{interval}} min. Issues are deduplicated by Jira Issue ID.", { interval: syncStatus.syncInterval })}{syncStatus.syncEnabled ? ` — ${t("trello.connected", "active").toLowerCase()}` : ` — ${t("trello.messages.auto_sync_paused", "paused").toLowerCase()}`}</p>
        </CardContent>
      </Card>
      {isEditing && (
        <Card className="mt-4 border-[var(--primary)]/30 bg-[var(--primary)]/[0.02]">
          <CardHeader className="py-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Settings size={16} className="text-[var(--primary)]" />{t("trello.wizard.configure_mappings", "Edit Sync Configuration")}</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(false)}><X size={16} /></Button>
          </CardHeader>
          <CardContent className="py-6 space-y-6">
            <div className="grid gap-2 max-w-xs">
              <Label htmlFor="edit-interval" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{t("jira.interval_minutes", "Sync Interval (Minutes)")}</Label>
              <Input
                id="edit-interval"
                type="number"
                min={5}
                max={1440}
                value={editInterval}
                onChange={e => {
                  const val = e.target.value;
                  if (val === "") {
                    setEditInterval("");
                  } else {
                    const parsed = parseInt(val, 10);
                    setEditInterval(isNaN(parsed) ? "" : parsed);
                  }
                }}
                className="h-9 w-full bg-[var(--background)] border border-[var(--border)] focus-visible:ring-[var(--primary)]"
              />
              <span className="text-[10px] text-[var(--muted-foreground)]/80 italic">
                {t("jira.interval_hint", "Enter time in minutes (minimum 5 minutes)")}
              </span>
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{t("trello.wizard.configure_mappings", "Status Mappings")}</Label>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="grid grid-cols-2 px-6 py-2 bg-[var(--muted)]/30 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)]"><span>{t("trello.wizard.trello_list", "Jira Status").replace("Trello List", "Jira Status").replace("Lista do Trello", "Status do Jira").replace("Liste Trello", "Statut Jira").replace("Lista de Trello", "Estado de Jira")}</span><span>{t("trello.wizard.taskosaur_status", "Taskosaur Status")}</span></div>
                {jiraStatuses.map(s => (
                  <div key={s.id} className="grid grid-cols-2 items-center px-6 py-3 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs font-medium">{s.name}</span>
                    <Select value={editMappings[s.id] || "none"} onValueChange={v => setEditMappings(p => ({ ...p, [s.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("jira.default_status", "Default")} /></SelectTrigger>
                      <SelectContent className="bg-[var(--card)] border border-[var(--border)] shadow-xl"><SelectItem value="none"><em>{t("jira.default_status", "Default")}</em></SelectItem>{activeStatuses.map(ts => <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <ActionButton variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>{t("jira.cancel", "Cancel")}</ActionButton>
              <ActionButton
                primary
                size="sm"
                onClick={handleSaveEdit}
                disabled={saving}
                leftIcon={saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              >
                {t("jira.save_changes", "Save Changes")}
              </ActionButton>
            </div>
          </CardContent>
        </Card>
      )}
      <ConfirmationModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDisconnect} title={t("jira.disconnect_modal_title", "Disconnect Jira")} message={t("jira.disconnect_modal_message", "This will stop all syncing. Existing tasks will not be deleted.")} confirmText={t("jira.disconnect", "Disconnect")} cancelText={t("jira.cancel", "Cancel")} type="danger" />
    </>
  );

  if (step === "status") return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center gap-3"><SiJira className="text-[#0052CC]" size={24} /><div><CardTitle className="text-md">{t("jira.title", "Jira Sync")}</CardTitle><CardDescription>{t("jira.subtitle", "Import Jira issues as tasks automatically")}</CardDescription></div></div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
          {[
            t("trello.features.import_cards", "Import issues from Jira Cloud").replace("Trello cards", "Jira issues").replace("cartões de Trello", "problemas de Jira").replace("cartes Trello", "tickets Jira"),
            t("trello.features.map_lists", "Map Jira statuses to Taskosaur statuses").replace("Trello lists", "Jira statuses").replace("listas de Trello", "estados de Jira").replace("listes Trello", "statuts Jira").replace("listas do Trello", "status do Jira"),
            t("trello.features.auto_sync", "Auto-sync on a schedule"),
            t("trello.sync_now", "Manual sync on demand"),
            t("trello.features.per_user", "Per-project credentials (encrypted)").replace("Each user can connect their own Trello account", "Per-project credentials (encrypted)").replace("Cada usuário pode conectar sua própria conta do Trello", "Credenciais por projeto (criptografadas)").replace("Chaque utilisateur peut connecter son propre compte Trello", "Identifiants par projet (chiffrés)").replace("Cada usuario puede conectar su propia cuenta de Trello", "Credenciales por proyecto (encriptadas)")
          ].map(f => (
            <div key={f} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/30">
              <div className="w-5 h-5 rounded-full bg-[#0052CC]/10 flex items-center justify-center shrink-0"><Check size={12} className="text-[#0052CC]" /></div>
              <span className="text-xs font-medium text-[var(--muted-foreground)]">{f}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center pt-6 border-t border-[var(--border)]">
          <ActionButton primary size="lg" className="px-10" leftIcon={<SiJira size={18} />} onClick={() => setStep("credentials")}>{t("jira.connect_btn", "Connect Jira")}</ActionButton>
          <p className="mt-3 text-[10px] text-[var(--muted-foreground)]">{t("trello.wizard.encryption_hint", "Credentials are encrypted with AES-256")}</p>
        </div>
      </CardContent>
    </Card>
  );

  const stepIndex = step === "credentials" ? 0 : step === "project" ? 1 : 2;

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center gap-3"><SiJira className="text-[#0052CC]" size={24} /><div><CardTitle className="text-md">Connect Jira</CardTitle><CardDescription>Follow the steps to link your Jira project</CardDescription></div></div>
        <Stepper step={stepIndex} />
      </CardHeader>
      <CardContent className="pt-8 pb-8">
        {step === "credentials" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="p-4 rounded-xl bg-[#0052CC]/5 border border-[#0052CC]/10 space-y-2">
              <div className="flex items-center gap-2 text-[#0052CC] font-semibold text-sm"><AlertCircle size={16} />{t("trello.wizard.prerequisites", "Prerequisites")}</div>
              <ol className="space-y-1 text-sm text-[var(--muted-foreground)] list-decimal ml-4">
                <li>
                  {t("jira.go_to", "Go to")}{" "}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[var(--primary)] font-semibold transition-colors text-[var(--primary)]"
                  >
                    {t("jira.atlassian_api_tokens", "Atlassian API Tokens")}
                  </a>{" "}
                  {t("jira.and_create_token", "and create a token.")}
                </li>
                <li>{t("jira.site_url_hint", "The full URL from your browser. The hostname must be permitted by the server's JIRA_ALLOWED_HOSTS setting.")}</li>
              </ol>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="jira-site-url">{t("jira.site_url_label", "Jira Site URL")}</Label>
                <Input id="jira-site-url" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://yourorg.atlassian.net" />
                <p className="text-[10px] text-[var(--muted-foreground)]">{t("jira.site_url_hint", "The full URL from your browser. The hostname must be permitted by the server's JIRA_ALLOWED_HOSTS setting.")}</p>
              </div>
              <div className="grid gap-2"><Label htmlFor="jira-email">{t("jira.email_label", "Atlassian Email")}</Label><Input id="jira-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="jira-token">{t("jira.api_token_label", "API Token")}</Label>
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline hover:text-[var(--primary)] text-[var(--muted-foreground)] transition-colors font-medium"
                  >
                    {t("jira.generate_token_link", "Generate API Token ↗")}
                  </a>
                </div>
                <div className="relative">
                  <Input id="jira-token" type={showToken ? "text" : "password"} value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="ATATT3xFfGF0..." className="pr-10" />
                  <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">{showToken ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <ActionButton variant="outline" onClick={() => setStep("status")}>{t("jira.cancel", "Cancel")}</ActionButton>
              <ActionButton
                primary
                onClick={handleValidate}
                disabled={connecting}
                leftIcon={connecting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              >
                {connecting ? t("jira.connecting", "Connecting...") : t("trello.wizard.validate_continue", "Validate & Continue")}
              </ActionButton>
            </div>
          </div>
        )}
        {step === "project" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <p className="text-sm text-[var(--muted-foreground)]">{t("trello.messages.found_boards", "Found {{count}} project(s). Select one to sync.", { count: jiraProjects.length }).replace("board(s)", "project(s)").replace("tablero(s)", "proyecto(s)").replace("tableau(x)", "projet(s)").replace("quadro(s)", "projeto(s)")}</p>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("trello.wizard.select_board_desc", "Select a Jira project").replace("Trello board", "Jira project").replace("tablero de Trello", "proyecto de Jira").replace("tableau Trello", "projet Jira").replace("quadro do Trello", "projeto do Jira")} /></SelectTrigger>
              <SelectContent className="max-h-72 bg-[var(--card)] border border-[var(--border)] shadow-xl">{jiraProjects.map(p => <SelectItem key={p.key} value={p.key}><span className="font-mono text-xs mr-2 text-[var(--muted-foreground)]">[{p.key}]</span>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex justify-between">
              <ActionButton variant="outline" onClick={() => setStep("credentials")}>{t("jira.back", "Back")}</ActionButton>
              <ActionButton
                primary
                onClick={handleSelectProject}
                disabled={connecting || !selectedProject}
                leftIcon={connecting ? <Loader2 size={14} className="animate-spin" /> : null}
              >
                {connecting ? t("jira.loading_statuses", "Loading Statuses...") : t("jira.next_map_statuses", "Next: Map Statuses")}
              </ActionButton>
            </div>
          </div>
        )}
        {step === "mapping" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="grid gap-2 max-w-xs">
              <Label htmlFor="sync-interval" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{t("jira.interval_minutes", "Sync Interval (Minutes)")}</Label>
              <Input
                id="sync-interval"
                type="number"
                min={5}
                max={1440}
                value={syncInterval}
                onChange={e => {
                  const val = e.target.value;
                  if (val === "") {
                    setSyncInterval("");
                  } else {
                    const parsed = parseInt(val, 10);
                    setSyncInterval(isNaN(parsed) ? "" : parsed);
                  }
                }}
                className="h-9 w-full bg-[var(--background)] border border-[var(--border)] focus-visible:ring-[var(--primary)]"
              />
              <span className="text-[10px] text-[var(--muted-foreground)]/80 italic">
                {t("jira.interval_hint", "Enter time in minutes (minimum 5 minutes)")}
              </span>
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{t("trello.wizard.mapping_desc", "Map Jira Statuses → Taskosaur Statuses").replace("Trello list to a Taskosaur status", "Jira status to a Taskosaur status").replace("lista de Trello a un estado de Taskosaur", "estado de Jira a un estado de Taskosaur").replace("liste Trello à un état Taskosaur", "statut Jira à un état Taskosaur").replace("lista do Trello para um status do Taskosaur", "status do Jira para um status do Taskosaur")}</Label>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="grid grid-cols-2 px-6 py-2 bg-[var(--muted)]/30 text-[10px] font-bold uppercase text-[var(--muted-foreground)] border-b border-[var(--border)]"><span>{t("trello.wizard.trello_list", "Jira Status").replace("Trello List", "Jira Status").replace("Lista do Trello", "Status do Jira").replace("Liste Trello", "Statut Jira").replace("Lista de Trello", "Estado de Jira")}</span><span>{t("trello.wizard.taskosaur_status", "Taskosaur Status")}</span></div>
                {jiraStatuses.map(s => (
                  <div key={s.id} className="grid grid-cols-2 items-center px-6 py-3 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs font-medium">{s.name}</span>
                    <Select value={statusMappings[s.id] || "none"} onValueChange={v => setStatusMappings(p => ({ ...p, [s.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("jira.default_status", "Default")} /></SelectTrigger>
                      <SelectContent className="bg-[var(--card)] border border-[var(--border)] shadow-xl"><SelectItem value="none"><em>{t("jira.default_status", "Default")}</em></SelectItem>{activeStatuses.map(ts => <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <ActionButton variant="outline" onClick={() => setStep("project")}>{t("jira.back", "Back")}</ActionButton>
              <ActionButton
                primary
                onClick={handleConnect}
                disabled={connecting}
                leftIcon={connecting ? <Loader2 size={14} className="animate-spin" /> : <SiJira size={14} />}
              >
                {connecting ? t("jira.connecting", "Connecting...") : t("trello.wizard.connect_start", "Connect & Import").replace("Start Sync", "Import").replace("iniciar sincronización", "importar").replace("démarrer la synchronisation", "importer").replace("iniciar sincronização", "importar")}
              </ActionButton>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
