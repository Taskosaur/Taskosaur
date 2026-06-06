import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, CheckCircle, Eye, EyeOff, Loader2, Plug, RefreshCw, X } from "lucide-react";
import { SiJira } from "react-icons/si";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JiraProject, JiraStatus, JiraSyncStatus, useJiraSync } from "@/hooks/useJiraSync";
import api from "@/lib/api";
import ConfirmationModal from "../modals/ConfirmationModal";
import ActionButton from "@/components/common/ActionButton";
import { useTranslation } from "react-i18next";

interface Props { workspaceId: string; organizationId?: string; }

export default function JiraWorkspaceSyncPanel({ workspaceId, organizationId }: Props) {
  const { t } = useTranslation("integrations");
  const router = useRouter();
  const rawWorkspaceSlug = router.query.workspaceSlug;
  const workspaceSlug = Array.isArray(rawWorkspaceSlug) ? rawWorkspaceSlug[0] : rawWorkspaceSlug;
  const {
    connectWorkspace,
    getWorkspaceStatus,
    listWorkspaceProjects,
    importProjectsToWorkspace,
    syncAllWorkspaceProjects,
    disconnectWorkspace,
    getWorkspaceSyncedProjects,
    listWorkspaceProjectStatuses,
    updateWorkspaceConfig,
    validateAndListStatuses,
  } = useJiraSync();

  const [status, setStatus] = useState<JiraSyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [step, setStep] = useState<"status" | "credentials" | "connected" | "select_projects" | "mapping">("status");
  const [siteUrl, setSiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedProjects, setSyncedProjects] = useState<any[]>([]);
  const [jiraStatuses, setJiraStatuses] = useState<Record<string, JiraStatus[]>>({});
  const [statusMappings, setStatusMappings] = useState<Record<string, Record<string, string>>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [internalStatuses, setInternalStatuses] = useState<{ id: string; name: string }[]>([]);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isEditingCreds, setIsEditingCreds] = useState(false);

  const refresh = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const s = await getWorkspaceStatus(workspaceId);
      setStatus(s);
      if (s) { setStep("connected"); const p = await getWorkspaceSyncedProjects(workspaceId); setSyncedProjects(p); }
    } catch {}
    finally { setLoadingStatus(false); }
  }, [workspaceId, getWorkspaceStatus, getWorkspaceSyncedProjects]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleConnect = async () => {
    if (!siteUrl.trim() || !email.trim() || !apiToken.trim()) { toast.error("All fields required"); return; }
    const normalizedSiteUrl = siteUrl.trim();
    setConnecting(true);
    try {
      await connectWorkspace(workspaceId, { jiraSiteUrl: normalizedSiteUrl, jiraEmail: email.trim(), jiraApiToken: apiToken.trim() });
      await refresh();
      toast.success("Jira account connected!");
      setStep("select_projects");
      handleLoadProjects();
    } catch (e: any) { toast.error(e.message); }
    finally { setConnecting(false); }
  };

  const handleLoadProjects = async () => {
    setLoadingProjects(true);
    try { const p = await listWorkspaceProjects(workspaceId); setJiraProjects(p); setStep("select_projects"); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoadingProjects(false); }
  };

  const handleGoToMapping = async () => {
    if (selectedKeys.size === 0) { toast.error("Select at least one project"); return; }
    setLoadingStatuses(true);
    try {
      const newJiraStatuses: Record<string, JiraStatus[]> = {};
      const newMappings: Record<string, Record<string, string>> = {};
      
      for (const key of selectedKeys) {
        let statuses: JiraStatus[] = [];
        
        if (status) {
          // Use saved workspace credentials
          statuses = await listWorkspaceProjectStatuses(workspaceId, key);
        } else {
          // Use temporary credentials from state
          statuses = await validateAndListStatuses(siteUrl, key, email.trim(), apiToken.trim());
        }
        
        newJiraStatuses[key] = statuses;
        newMappings[key] = {};
        statuses.forEach(s => { newMappings[key][s.id] = ""; });
      }
      
      setJiraStatuses(newJiraStatuses);
      setStatusMappings(newMappings);
      
      // Load internal statuses for mapping
      if (organizationId) {
        try {
          const res = await api.get(`/workflows/organization/${organizationId}/default`);
          if (res.data && res.data.statuses) {
            setInternalStatuses(res.data.statuses);
          }
        } catch (e) {
          console.error("Failed to load internal statuses", e);
        }
      }
      
      setStep("mapping");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingStatuses(false); }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const projectsPayload = Array.from(selectedKeys).map(key => ({
        key,
        statusMappings: statusMappings[key] ? Object.fromEntries(Object.entries(statusMappings[key]).filter(([, v]) => v && v !== "none")) : {}
      }));
      
      const r = await importProjectsToWorkspace(workspaceId, projectsPayload);
      toast.success(`Imported ${r.importedProjectsCount} project(s)`);
      setSelectedKeys(new Set()); setJiraProjects([]); setStep("connected");
      const p = await getWorkspaceSyncedProjects(workspaceId); setSyncedProjects(p);
      await refresh();
      router.replace(router.asPath);
    } catch (e: any) { toast.error(e.message); }
    finally { setImporting(false); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try { const r = await syncAllWorkspaceProjects(workspaceId); toast.success(`Synced ${r.successCount}/${r.total} projects`); await refresh(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    setConfirmDisconnect(false); setDisconnecting(true);
    try { await disconnectWorkspace(workspaceId); setStatus(null); setStep("status"); setSyncedProjects([]); setSiteUrl(""); toast.success("Jira disconnected"); }
    catch (e: any) { toast.error(e.message); }
    finally { setDisconnecting(false); }
  };

  const handleUpdateCreds = async () => {
    if (!siteUrl.trim() || !email.trim() || !apiToken.trim()) { toast.error("All fields required"); return; }
    setConnecting(true);
    try { await updateWorkspaceConfig(workspaceId, { jiraSiteUrl: siteUrl.trim(), jiraEmail: email.trim(), jiraApiToken: apiToken.trim() }); toast.success("Credentials updated"); setIsEditingCreds(false); }
    catch (e: any) { toast.error(e.message); }
    finally { setConnecting(false); }
  };

  if (loadingStatus) return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]"><div className="flex items-center gap-3"><SiJira className="text-[#0052CC]" size={24} /><CardTitle className="text-md">{t("jira.workspace_title", "Jira Workspace Sync")}</CardTitle></div></CardHeader>
      <CardContent className="py-10 flex flex-col items-center gap-4"><Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" /><p className="text-sm text-[var(--muted-foreground)]">{t("trello.loading_status", "Loading...")}</p></CardContent>
    </Card>
  );

  if (step === "status") return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center gap-3"><SiJira className="text-[#0052CC]" size={24} /><div><CardTitle className="text-md">{t("jira.workspace_title", "Jira Workspace Sync")}</CardTitle><CardDescription>{t("jira.subtitle", "Import Jira issues as tasks automatically")}</CardDescription></div></div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {[
          t("trello.features.import_cards", "Import multiple Jira projects as Taskosaur projects").replace("Trello cards", "Jira projects").replace("cartões de Trello", "projetos de Jira").replace("cartes Trello", "projets Jira"),
          t("trello.features.auto_sync", "Bulk sync all connected projects"),
          t("trello.features.per_user", "Shared credentials across projects").replace("Each user can connect their own Trello account", "Shared credentials across projects"),
          t("trello.wizard.encryption_hint", "Encrypted AES-256 storage")
        ].map(f => (
          <div key={f} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/30">
            <div className="w-5 h-5 rounded-full bg-[#0052CC]/10 flex items-center justify-center shrink-0"><Check size={12} className="text-[#0052CC]" /></div>
            <span className="text-xs font-medium text-[var(--muted-foreground)]">{f}</span>
          </div>
        ))}
        <div className="flex flex-col items-center pt-4 border-t border-[var(--border)]">
          <ActionButton primary size="lg" className="px-10" leftIcon={<SiJira size={18} />} onClick={() => setStep("credentials")}>{t("jira.connect_btn", "Connect Jira Account")}</ActionButton>
        </div>
      </CardContent>
    </Card>
  );

  if (step === "credentials") return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center gap-3"><SiJira className="text-[#0052CC]" size={24} /><div><CardTitle className="text-md">{t("jira.connect_btn", "Connect Jira Account")}</CardTitle><CardDescription>{t("trello.wizard.connect_subtitle", "Enter your Atlassian credentials")}</CardDescription></div></div>
      </CardHeader>
      <CardContent className="pt-8 space-y-4 max-w-lg">
        <div className="p-4 rounded-xl bg-[#0052CC]/5 border border-[#0052CC]/10 text-sm text-[var(--muted-foreground)] space-y-1">
          <div className="flex items-center gap-2 text-[#0052CC] font-semibold"><AlertCircle size={15} />{t("trello.wizard.prerequisites", "Required")}</div>
          <p>
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
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ws-site-url">{t("jira.site_url_label", "Jira Site URL")}</Label>
          <Input id="ws-site-url" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://yourorg.atlassian.net" />
          <p className="text-[10px] text-[var(--muted-foreground)]">{t("jira.site_url_hint", "The full URL from your browser. The hostname must be permitted by the server's JIRA_ALLOWED_HOSTS setting.")}</p>
        </div>
        <div className="grid gap-2"><Label htmlFor="ws-email">{t("jira.email_label", "Email")}</Label><Input id="ws-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div className="grid gap-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="ws-token">{t("jira.api_token_label", "API Token")}</Label>
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
            <Input id="ws-token" type={showToken ? "text" : "password"} value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="ATATT3xFfGF0..." className="pr-10" />
            <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">{showToken ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <ActionButton variant="outline" onClick={() => setStep("status")}>{t("jira.cancel", "Cancel")}</ActionButton>
          <ActionButton
            primary
            onClick={handleConnect}
            disabled={connecting}
            leftIcon={connecting ? <Loader2 size={14} className="animate-spin" /> : <SiJira size={14} />}
          >
            {connecting ? t("jira.connecting", "Connecting…") : t("trello.wizard.connect_start", "Connect")}
          </ActionButton>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Card className="border-none bg-[var(--card)]">
        <CardHeader className="border-b border-[var(--border)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3"><SiJira className="text-[#0052CC]" size={24} /><div><CardTitle className="text-md">{t("jira.workspace_title", "Jira Workspace Sync")}</CardTitle><CardDescription>{t("jira.connected_to", "Connected to")} <Badge variant="outline" className="font-mono text-[10px] border-[var(--border)] bg-transparent text-[var(--muted-foreground)] ml-1.5">{status?.jiraSiteUrl}</Badge></CardDescription></div></div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={refresh}><RefreshCw size={14} /></Button>
              <Badge variant="outline" className="gap-1.5 py-1 px-3 border-emerald-500/30 text-emerald-500 bg-emerald-500/5"><CheckCircle size={12} />{t("jira.connected", "Connected")}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {syncedProjects.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">{t("jira.synced_projects", "Synced Projects")} ({syncedProjects.length})</h4>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="grid grid-cols-4 px-4 py-2 bg-[var(--muted)]/30 text-[10px] font-bold uppercase text-[var(--muted-foreground)] border-b border-[var(--border)]"><span>{t("jira.project", "Project")}</span><span>{t("jira.jira_key", "Jira Key")}</span><span>{t("jira.last_sync", "Last Sync")}</span><span>{t("jira.status", "Status")}</span></div>
                {syncedProjects.map(p => (
                  <div key={p.id} className="grid grid-cols-4 items-center px-4 py-3 border-b border-[var(--border)] last:border-0 text-sm">
                    <Link href={`/${encodeURIComponent(workspaceSlug ?? "")}/${encodeURIComponent(p.slug ?? "")}`} className="font-medium truncate hover:underline hover:text-[var(--primary)] text-left">
                      {p.name}
                    </Link>
                    <div className="flex items-center justify-start">
                      <Badge variant="outline" className="font-mono text-[10px] border-[var(--border)] bg-transparent text-[var(--muted-foreground)] font-medium py-0.5 px-2 h-5 w-fit">{p.jiraProjectKey}</Badge>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleDateString() : t("jira.never_synced", "Never")}</span>
                    <Badge variant={p.lastSyncStatus === "SUCCESS" ? "default" : "outline"} className={cn("text-[10px] w-fit", p.lastSyncStatus === "SUCCESS" && "bg-emerald-500 border-none")}>{p.lastSyncStatus ?? "—"}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleLoadProjects} disabled={loadingProjects} className="gap-2">{loadingProjects ? <Loader2 size={14} className="animate-spin" /> : <SiJira size={14} />}{t("jira.browse_projects", "Browse Projects")}</Button>
            {syncedProjects.length > 0 && <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={syncing} className="gap-2">{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}{t("jira.sync_all", "Sync All")}</Button>}
            <Button size="sm" variant="outline" onClick={() => { setIsEditingCreds(true); setSiteUrl(status?.jiraSiteUrl || ""); setEmail(""); setApiToken(""); }} className="gap-2">{t("jira.update_credentials", "Update Credentials")}</Button>
            <ActionButton
              type="button"
              variant="destructive"
              onClick={() => setConfirmDisconnect(true)}
              disabled={disconnecting}
              leftIcon={disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              className="ml-auto h-8"
            >
              {t("jira.disconnect", "Disconnect")}
            </ActionButton>
          </div>
        </CardContent>
      </Card>
      {isEditingCreds && (
        <Card className="mt-4 border-[var(--primary)]/30">
          <CardHeader className="py-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{t("jira.update_creds_title", "Update Jira Credentials")}</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditingCreds(false)}><X size={16} /></Button>
          </CardHeader>
          <CardContent className="py-6 space-y-4 max-w-lg">
            <div className="grid gap-2">
              <Label>{t("jira.site_url_label", "Jira Site URL")}</Label>
              <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://yourorg.atlassian.net" />
              <p className="text-[10px] text-[var(--muted-foreground)]">{t("jira.site_url_hint", "The full URL from your browser. The hostname must be permitted by the server's JIRA_ALLOWED_HOSTS setting.")}</p>
            </div>
            <div className="grid gap-2"><Label>{t("jira.email_label", "Email")}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div className="grid gap-2"><Label>{t("jira.new_api_token_label", "New API Token")}</Label>
              <div className="relative">
                <Input type={showToken ? "text" : "password"} value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="ATATT3xFfGF0…" className="pr-10" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">{showToken ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
             <div className="flex justify-end gap-3">
              <ActionButton variant="outline" size="sm" onClick={() => setIsEditingCreds(false)}>{t("jira.cancel", "Cancel")}</ActionButton>
              <ActionButton
                primary
                size="sm"
                onClick={handleUpdateCreds}
                disabled={connecting}
                leftIcon={connecting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              >
                {t("jira.save", "Save")}
              </ActionButton>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "select_projects" && (() => {
        const syncedKeys = new Set(syncedProjects.map(sp => sp.jiraProjectKey));
        const unsyncedProjects = jiraProjects.filter(p => !syncedKeys.has(p.key));
        return (
          <Card className="mt-4 border-[var(--primary)]/30 animate-in fade-in slide-in-from-top-2 duration-300">
            <CardHeader className="py-4 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-sm">Step 2: {t("jira.browse_projects", "Select Projects to Import")}</CardTitle><CardDescription className="text-xs">{t("trello.wizard.select_board_desc", "Choose which Jira projects to bring into Taskosaur").replace("Trello board to sync with this project.", "Jira projects to bring into Taskosaur")}</CardDescription></div>
                <Button variant="ghost" size="sm" onClick={() => setStep("connected")}><X size={16} /></Button>
              </div>
            </CardHeader>
            <CardContent className="py-4">
              <div className="max-h-72 overflow-y-auto space-y-1 mb-4 pr-2">
                {unsyncedProjects.map(p => (
                  <label key={p.key} className={cn("flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--muted)]/30 cursor-pointer transition-colors border border-transparent", selectedKeys.has(p.key) && "bg-[var(--primary)]/5 border-[var(--primary)]/20")}>
                    <input type="checkbox" checked={selectedKeys.has(p.key)} onChange={e => { const s = new Set(selectedKeys); e.target.checked ? s.add(p.key) : s.delete(p.key); setSelectedKeys(s); }} className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)]" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)]">{t("jira.jira_key", "Key")}: {p.key}</span>
                    </div>
                  </label>
                ))}
                {jiraProjects.length > 0 && unsyncedProjects.length === 0 && (
                  <div className="py-10 text-center text-sm text-[var(--muted-foreground)] italic border border-dashed border-[var(--border)] rounded-lg">
                    {t("jira.all_projects_synced", "All projects are already synced!")}
                  </div>
                )}
                {jiraProjects.length === 0 && (
                  <div className="py-10 text-center text-sm text-[var(--muted-foreground)] italic border border-dashed border-[var(--border)] rounded-lg">
                    {t("jira.no_projects_found", "No projects found. Try checking your credentials.")}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-[var(--border)]">
                <ActionButton variant="outline" size="sm" onClick={() => setStep("connected")}>{t("jira.cancel", "Cancel")}</ActionButton>
                <div className="flex gap-3">
                  <span className="text-xs text-[var(--muted-foreground)] self-center">{t("jira.selected", { count: selectedKeys.size })}</span>
                  <ActionButton
                    primary
                    onClick={handleGoToMapping}
                    disabled={loadingStatuses || selectedKeys.size === 0}
                    leftIcon={loadingStatuses ? <Loader2 size={14} className="animate-spin" /> : <SiJira size={14} />}
                  >
                    {loadingStatuses ? t("jira.loading_statuses", "Loading Statuses…") : t("jira.next_map_statuses", "Next: Map Statuses")}
                  </ActionButton>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {step === "mapping" && (
        <Card className="mt-4 border-[var(--primary)]/30 animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="py-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-sm">Step 3: {t("jira.map_statuses_title", "Map Statuses")}</CardTitle><CardDescription className="text-xs">{t("trello.wizard.mapping_desc", "Optional: Direct Jira statuses to specific Taskosaur statuses")}</CardDescription></div>
              <Button variant="ghost" size="sm" onClick={() => setStep("select_projects")}><X size={16} /></Button>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-600 mb-6 flex items-start gap-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{t("trello.wizard.mapping_desc", "By default we'll auto map...").replace("Trello list to a Taskosaur status. Unmapped lists will use the project default status.", "Jira status to a Taskosaur status by name. New statuses will be created if they don't exist.")}</p>
            </div>

            <div className="space-y-8">
              {Array.from(selectedKeys).map(projectKey => (
                <div key={projectKey} className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[9px]">{projectKey}</Badge> {t("jira.step_mapping", "Status Mapping")}
                  </h4>
                  <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]/30">
                    <div className="grid grid-cols-2 px-4 py-2 bg-[var(--muted)]/50 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] border-b border-[var(--border)]">
                      <span>{t("trello.wizard.trello_list", "Jira Status").replace("Trello List", "Jira Status").replace("Lista do Trello", "Status do Jira").replace("Liste Trello", "Statut Jira").replace("Lista de Trello", "Estado de Jira")}</span>
                      <span>{t("trello.wizard.taskosaur_status", "Taskosaur Status")}</span>
                    </div>
                    {jiraStatuses[projectKey]?.map(s => (
                      <div key={s.id} className="grid grid-cols-2 items-center px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/20 transition-colors">
                        <span className="text-xs font-medium">{s.name}</span>
                        <Select 
                          value={statusMappings[projectKey]?.[s.id] || "none"} 
                          onValueChange={v => setStatusMappings(prev => ({
                            ...prev,
                            [projectKey]: { ...prev[projectKey], [s.id]: v }
                          }))}
                        >
                          <SelectTrigger className="h-8 text-[10px] border-[var(--border)] bg-[var(--card)]">
                            <SelectValue placeholder={t("jira.default_status", "Default")} />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                            <SelectItem value="none"><em className="opacity-70">{t("jira.default_status", "Default (Auto-map)")}</em></SelectItem>
                            {internalStatuses.map(is => (
                              <SelectItem key={is.id} value={is.id}>{is.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-[var(--border)] mt-8">
              <ActionButton variant="outline" size="sm" onClick={() => setStep("select_projects")}>{t("jira.back", "Back")}</ActionButton>
              <ActionButton
                primary
                onClick={handleImport}
                disabled={importing}
                leftIcon={importing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                className="shadow-lg px-8"
              >
                {importing ? t("jira.importing", "Importing Projects…") : t("jira.finish_import", "Finish & Import All")}
              </ActionButton>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmationModal isOpen={confirmDisconnect} onClose={() => setConfirmDisconnect(false)} onConfirm={handleDisconnect} title={t("jira.disconnect_workspace_modal_title", "Disconnect Jira Workspace")} message={t("jira.disconnect_workspace_modal_message", "This will remove the workspace Jira connection. Project syncs already set up will continue working.")} confirmText={t("jira.disconnect", "Disconnect")} cancelText={t("jira.cancel", "Cancel")} type="danger" />
    </>
  );
}
