import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import { BookOpen, ArrowLeft, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workspaceApi } from "@/utils/api/workspaceApi";
import { useOrganization } from "@/contexts/organization-context";
import { projectApi } from "@/utils/api/projectApi";
import { useAuth } from "@/contexts/auth-context";
import DocumentMarkdown from "./DocumentMarkdown";
import DocumentSources from "./DocumentSources";
import {
  documentsApi,
  documentError,
  documentHref,
  documentFilename,
  DocumentSource,
  DocumentScope,
  sourceLabel,
  sourceHome,
  sourceLineage,
  ProjectDocument,
} from "./documents-api";

const documentCategories = [
  { value: "Coordination", description: "Planning, delegation and delivery" },
  { value: "Guidance", description: "Principles, rules and permissions" },
  { value: "Knowledge", description: "Context, architecture and references" },
  { value: "Capabilities", description: "Skills, tools, connections and workers" },
  { value: "Operations", description: "Runtime, handoffs, recovery and usage" },
];

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export default function ProjectDocuments() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { currentOrganization } = useOrganization();
  const { resolvedTheme } = useTheme();
  const workspace =
    typeof router.query.workspaceSlug === "string" ? router.query.workspaceSlug : "";
  const project = typeof router.query.projectSlug === "string" ? router.query.projectSlug : "";
  const requestedPath = typeof router.query.path === "string" ? router.query.path : "";
  const task = typeof router.query.task === "string" ? router.query.task : "";
  const localScope: DocumentScope = project ? "project" : workspace ? "workspace" : "organization";
  const [localOwner, setLocalOwner] = useState<{ id: string; name: string } | null>(null);
  const [sources, setSources] = useState<DocumentSource[]>([]);
  const requestedScope = router.query.scope;
  const requestedOwner = typeof router.query.ownerId === "string" ? router.query.ownerId : "";
  const index =
    sources.find((item) =>
      requestedOwner
        ? item.ownerId === requestedOwner && item.scope === requestedScope
        : item.ownerId === localOwner?.id && item.scope === localScope
    ) || null;
  const projectId = index?.ownerId || "";
  const selectedScope = index?.scope || localScope;
  const [createOwnerKey, setCreateOwnerKey] = useState("");
  const createOwner = sources.find((item) => `${item.scope}/${item.ownerId}` === createOwnerKey);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [doc, setDoc] = useState<ProjectDocument | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState("");
  const sourceMatches =
    loadedIdentity === `${selectedScope}/${projectId}/${requestedPath || index?.entrypoint || ""}`;
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [unconfigured, setUnconfigured] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<ProjectDocument | null>(null);
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [customFilename, setCustomFilename] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [listVersion, setListVersion] = useState(0);
  const editOnce = useRef("");
  const dirty = editing && !!doc && draft !== doc.content;
  const dirtyRef = useRef(dirty);
  const createDirty = createOpen;
  dirtyRef.current = dirty || createDirty;
  const path = requestedPath || index?.entrypoint || "";
  const sourceTitle = doc?.content
    .replace(/^\uFEFF?<!-- taskosaur: \{[^\r\n]*\} -->\r?\n/, "")
    .trimStart()
    .match(/^#\s+([^\r\n]+?)(?:\s+#+)?\s*(?:\r?\n|$)/)?.[1];
  const sourceHasTitle = sourceTitle?.replace(/[*_`]/g, "").trim() === doc?.title.trim();
  const hrefFor = (nextPath: string) =>
    documentHref(workspace, project, nextPath, task, index || undefined);
  const searchScope =
    localScope === "organization"
      ? "this organization, its workspaces and projects"
      : localScope === "workspace"
        ? "this workspace, its projects and parent guidance"
        : "this project and parent guidance";
  const filename = customFilename ?? documentFilename(newTitle);
  const folder = newFolder.trim();
  const newPath = folder ? `${folder}/${filename}` : filename;
  const folders = Array.from(
    new Set(
      [
        ...(createOwner?.documents || []),
        { path: createOwner?.ownerId === projectId ? path : "" },
      ].flatMap((item) => {
        const parts = item.path.split("/").slice(0, -1);
        return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
      })
    )
  ).sort();
  const validLocation =
    (!folder ||
      folder
        .split("/")
        .every((part) => part && part !== "." && part !== ".." && !/[\\:*?"<>|]/.test(part))) &&
    /^[^\\/:*?"<>|]+\.md$/i.test(filename) &&
    !/^\.{1,2}\.md$/.test(filename);

  useEffect(() => {
    let currentHistoryState = window.history.state;
    const rememberHistory = () => {
      currentHistoryState = window.history.state;
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const routeChange = () => {
      if (!dirtyRef.current || window.confirm("Discard your unsaved document changes and leave?"))
        return;
      router.events.emit("routeChangeError", new Error("Navigation cancelled"), router.asPath, {
        shallow: false,
      });
      // Pages Router requires a thrown cancellation to stop a pending transition.
      throw "Document navigation cancelled";
    };
    window.addEventListener("beforeunload", beforeUnload);
    router.events.on("routeChangeStart", routeChange);
    router.events.on("routeChangeComplete", rememberHistory);
    router.events.on("hashChangeComplete", rememberHistory);
    router.beforePopState(() => {
      if (!dirtyRef.current || window.confirm("Discard your unsaved document changes and leave?")) {
        dirtyRef.current = false;
        return true;
      }
      // Restore the current route and its Next state for either Back or Forward.
      window.history.pushState(currentHistoryState, "", router.asPath);
      return false;
    });
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      router.events.off("routeChangeStart", routeChange);
      router.events.off("routeChangeComplete", rememberHistory);
      router.events.off("hashChangeComplete", rememberHistory);
      router.beforePopState(() => true);
    };
  }, [router]);

  useEffect(() => {
    if (
      !router.isReady ||
      (localScope !== "project" &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          currentOrganization?.id || ""
        ))
    )
      return;
    let active = true;
    setLoading(true);
    setLocalOwner(null);
    setSources([]);
    setDoc(null);
    setError("");
    setUnconfigured(false);
    setCreateOpen(false);
    if (!isAuthenticated()) {
      setError("Sign in to read documents.");
      setLoading(false);
      return;
    }
    const owner = Promise.resolve().then<{ id: string; name: string }>(() =>
      localScope === "project"
        ? projectApi.getProjectBySlug(project, true, workspace)
        : localScope === "workspace"
          ? workspaceApi.getWorkspaceBySlug(workspace, currentOrganization?.id || "")
          : currentOrganization!
    );
    owner
      .then((result) => {
        if (active) setLocalOwner({ id: result.id, name: result.name });
      })
      .catch((err) => {
        if (active) {
          setError(documentError(err).message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router.isReady, project, workspace, localScope, currentOrganization?.id]);

  useEffect(() => {
    if (!localOwner) return;
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(
      () => {
        documentsApi
          .sources(localOwner.id, localScope, search, localScope !== "project")
          .then((result) => {
            if (active) {
              setSources(result.sources);
              setListError("");
              setUnconfigured(false);
              if (!requestedPath) setLoading(false);
            }
          })
          .catch((err) => {
            if (!active) return;
            if (documentError(err).status === 404) {
              setUnconfigured(true);
              setSources([]);
            } else setListError(documentError(err).message);
            setLoading(false);
          })
          .finally(() => {
            if (active) setSearching(false);
          });
      },
      search ? 200 : 0
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [localOwner, localScope, search, listVersion]);

  useEffect(() => {
    if (!projectId || !path) {
      setDoc(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setDoc(null);
    setError("");
    setEditing(false);
    setCreateOpen(false);
    setConflict(false);
    setLatest(null);
    setNotice("");
    documentsApi
      .read(projectId, path, selectedScope)
      .then((result) => {
        if (active) {
          if (result.canonicalReference) {
            void router.replace(
              documentHref(
                workspace,
                project,
                result.canonicalReference.path,
                task,
                result.canonicalReference
              ) + window.location.hash
            );
            return;
          }
          setLoadedIdentity(`${selectedScope}/${projectId}/${path}`);
          setDoc(result);
          setDraft(result.content);
        }
      })
      .catch((err) => {
        if (active)
          setError(
            documentError(err).status === 404
              ? "This document is no longer available. Choose another document from the list."
              : documentError(err).message
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, selectedScope, path]);

  useEffect(() => {
    const key = `${selectedScope}/${projectId}/${path}`;
    if (
      !sourceMatches ||
      !index?.canEdit ||
      !doc ||
      doc.path !== path ||
      router.query.edit !== "1" ||
      editOnce.current === key
    )
      return;
    editOnce.current = key;
    setEditing(true);
    const query = { ...router.query };
    delete query.edit;
    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  }, [doc, sourceMatches, path, projectId, selectedScope, index?.canEdit, router]);

  async function createDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || dirty || !createOwner?.canEdit || !newTitle.trim() || !validLocation) return;
    setCreating(true);
    setCreateError("");
    try {
      const created = await documentsApi.create(
        createOwner.ownerId,
        {
          path: newPath,
          title: newTitle.trim(),
        },
        createOwner.scope
      );
      setSearch("");
      setListVersion((value) => value + 1);
      setCreateOpen(false);
      dirtyRef.current = false;
      await router.push(
        `${documentHref(workspace, project, created.path, task, createOwner)}&edit=1`
      );
    } catch (err) {
      setCreateError(
        documentError(err).status === 409
          ? "A document already uses this path. Change the title, folder, or filename."
          : documentError(err).message
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!doc || editing || !router.asPath.includes("#")) return;
    let anchor: string;
    try {
      anchor = decodeURIComponent(router.asPath.slice(router.asPath.indexOf("#") + 1));
    } catch {
      return;
    }
    const frame = window.requestAnimationFrame(() =>
      document.getElementById(anchor)?.scrollIntoView()
    );
    return () => window.cancelAnimationFrame(frame);
  }, [doc, editing, router.asPath]);

  async function save() {
    if (!doc || !sourceMatches || saving || !index?.canEdit) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await documentsApi.save(
        projectId,
        {
          path: doc.path,
          content: draft,
          revision: doc.revision,
        },
        selectedScope
      );
      setDoc(saved);
      setDraft(saved.content);
      setEditing(false);
      setConflict(false);
      setLatest(null);
      setNotice("Saved to the source document.");
    } catch (err) {
      if (documentError(err).status === 409) {
        setConflict(true);
        setLatest(null);
      } else setError(documentError(err).message);
    } finally {
      setSaving(false);
    }
  }
  async function reviewLatest() {
    if (!doc || !sourceMatches) return;
    try {
      setLatest(await documentsApi.read(projectId, doc.path, selectedScope));
      setError("");
    } catch (err) {
      setError(documentError(err).message);
    }
  }
  function cancel() {
    if (dirty && !window.confirm("Discard your unsaved document changes?")) return;
    setDraft(doc?.content || "");
    setEditing(false);
    setConflict(false);
    setLatest(null);
    setError("");
  }
  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([draft], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `draft-${doc?.path.split("/").pop() || "document.md"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen size={20} /> Docs
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {localOwner
              ? sourceLabel({ scope: localScope, ownerName: localOwner.name })
              : "Documents"}{" "}
            · Read and edit the source in place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sources.some(
            (source) =>
              source.canEdit && source.ownerId === localOwner?.id && source.scope === localScope
          ) &&
            !unconfigured && (
              <Button
                disabled={dirty || saving || creating || createOpen}
                title={dirty ? "Save or cancel your edits before creating a document" : undefined}
                onClick={() => {
                  setCreateOwnerKey(`${localScope}/${localOwner?.id}`);
                  setNewTitle("");
                  setNewFolder(
                    selectedScope === localScope && projectId === localOwner?.id
                      ? path.split("/").slice(0, -1).join("/")
                      : ""
                  );
                  setCustomFilename(null);
                  setCreateError("");
                  setCreateOpen(true);
                }}
              >
                <Plus size={16} /> New document
              </Button>
            )}
          {task && (
            <Button variant="outline" asChild>
              <Link
                href={`/${encodeURIComponent(workspace)}/${encodeURIComponent(project)}/tasks/${encodeURIComponent(task)}`}
              >
                <ArrowLeft size={16} /> Back to task
              </Link>
            </Button>
          )}
        </div>
      </div>
      {createOpen && (
        <form
          onSubmit={createDocument}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
          aria-label="Create document"
        >
          <h2 className="text-sm font-semibold">New document</h2>
          <label className="block text-sm" htmlFor="new-document-owner">
            Document home
          </label>
          <select
            id="new-document-owner"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-sm"
            value={createOwnerKey}
            disabled={creating}
            onChange={(event) => {
              setCreateOwnerKey(event.target.value);
              setNewFolder("");
              setCreateError("");
            }}
          >
            {sources
              .filter((source) => source.canEdit)
              .map((source) => (
                <option
                  key={`${source.scope}/${source.ownerId}`}
                  value={`${source.scope}/${source.ownerId}`}
                >
                  {sourceHome(source)}
                </option>
              ))}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-document-title" className="block text-sm mb-1">
                Title
              </label>
              <Input
                id="new-document-title"
                autoFocus
                required
                maxLength={200}
                value={newTitle}
                disabled={creating}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Getting started"
              />
            </div>
            <div>
              <label htmlFor="new-document-folder" className="block text-sm mb-1">
                Parent folder
              </label>
              <Input
                id="new-document-folder"
                list="document-folders"
                value={newFolder}
                disabled={creating}
                onChange={(event) => setNewFolder(event.target.value)}
                placeholder="Owner root"
              />
              <datalist id="document-folders">
                {folders.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Leave blank for the root, or enter a nested folder such as guides/setup.
              </p>
            </div>
          </div>
          {customFilename !== null && (
            <div>
              <label htmlFor="new-document-filename" className="block text-sm mb-1">
                Filename
              </label>
              <Input
                id="new-document-filename"
                value={customFilename}
                disabled={creating}
                onChange={(event) => setCustomFilename(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">Will create in:</span>
            <span>{createOwner ? sourceHome(createOwner) : "Choose a document home"}</span>
            <span aria-hidden="true">/</span>
            <code className="break-all">{newPath}</code>
            {customFilename === null && (
              <button
                type="button"
                disabled={creating}
                className="text-[var(--primary)] underline"
                onClick={() => setCustomFilename(filename)}
              >
                Change filename
              </button>
            )}
          </div>
          {!validLocation && (
            <p className="text-sm text-red-600">
              Use a relative folder without dot segments, and a filename ending in .md.
            </p>
          )}
          {dirty && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Save or cancel your current edits before creating a document.
            </p>
          )}
          {createError && (
            <p role="alert" className="text-sm text-red-600">
              {createError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={creating}
              onClick={() => {
                if (!createDirty || window.confirm("Discard this new document?"))
                  setCreateOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                creating || dirty || !createOwner?.canEdit || !newTitle.trim() || !validLocation
              }
            >
              {creating ? "Creating…" : "Create document"}
            </Button>
          </div>
        </form>
      )}
      {unconfigured ? (
        <div className="rounded-lg border border-[var(--border)] p-8 bg-[var(--card)]">
          <h2 className="font-semibold">No document collection connected</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            No accessible document source is configured for this owner yet. Once connected, its
            documents will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 self-start xl:sticky xl:top-4">
            <label className="block text-xs font-medium mb-2" htmlFor="document-search">
              Search {searchScope}
            </label>
            <Input
              id="document-search"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="block text-xs font-medium mt-3 mb-2" htmlFor="document-category">
              Category
            </label>
            <Select
              value={category || "all"}
              onValueChange={(value) => setCategory(value === "all" ? "" : value)}
            >
              <SelectTrigger id="document-category" className="w-full bg-[var(--background)]">
                <SelectValue>
                  {category === "uncategorized" ? "Uncategorized" : category || "All categories"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                className="w-[var(--radix-select-trigger-width)] border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                align="start"
              >
                <SelectItem value="all">All categories</SelectItem>
                {documentCategories.map(({ value, description }) => (
                  <SelectItem
                    key={value}
                    value={value}
                    textValue={value}
                    aria-labelledby={"document-category-" + value + "-label"}
                    aria-describedby={"document-category-" + value + "-description"}
                    className="py-2 focus:bg-[var(--accent)] focus:text-[var(--accent-foreground)]"
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span id={"document-category-" + value + "-label"} className="font-medium">
                        {value}
                      </span>
                      <span
                        id={"document-category-" + value + "-description"}
                        className="text-xs leading-relaxed text-[var(--muted-foreground)]"
                      >
                        {description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem
                  value="uncategorized"
                  textValue="Uncategorized"
                  aria-labelledby="document-category-uncategorized-label"
                  aria-describedby="document-category-uncategorized-description"
                  className="py-2 focus:bg-[var(--accent)] focus:text-[var(--accent-foreground)]"
                >
                  <span className="flex flex-col items-start gap-0.5">
                    <span id="document-category-uncategorized-label" className="font-medium">
                      Uncategorized
                    </span>
                    <span
                      id="document-category-uncategorized-description"
                      className="text-xs leading-relaxed text-[var(--muted-foreground)]"
                    >
                      Documents without a category
                    </span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {listError && (
              <p role="alert" className="text-sm p-2 text-red-600">
                {listError}
              </p>
            )}
            <nav
              aria-label="Document sources"
              className="max-h-64 xl:max-h-[65vh] overflow-y-auto space-y-2 mt-3"
            >
              <DocumentSources
                sources={sources}
                localOwner={
                  localOwner
                    ? { scope: localScope, ownerId: localOwner.id, ownerName: localOwner.name }
                    : null
                }
                selectedOwner={{ scope: selectedScope, ownerId: projectId }}
                path={path}
                search={search}
                category={category}
                workspace={workspace}
                project={project}
                task={task}
              />
            </nav>
            {searching && (
              <p role="status" className="text-xs p-2 text-[var(--muted-foreground)]">
                Searching…
              </p>
            )}
          </aside>
          <section className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)]">
            {index && (
              <nav
                aria-label="Document home"
                className="border-b border-[var(--border)] px-5 py-3 text-xs"
              >
                <span className="font-semibold">Home:</span>
                <ol className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 ml-2">
                  {sourceLineage(index).map((owner, position) => {
                    const accessible = sources.find(
                      (source) => source.scope === owner.scope && source.ownerId === owner.ownerId
                    );
                    return (
                      <li
                        key={`${owner.scope}/${owner.ownerId}`}
                        className="inline-flex items-center gap-2"
                      >
                        {position > 0 && <span aria-hidden="true">/</span>}
                        {accessible ? (
                          <Link
                            className="text-[var(--primary)] underline"
                            href={documentHref(
                              workspace,
                              project,
                              accessible.entrypoint || undefined,
                              task,
                              accessible
                            )}
                          >
                            {sourceLabel(owner)}
                          </Link>
                        ) : (
                          <span>{sourceLabel(owner)}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
            {requestedOwner && !index && !searching && (
              <p role="alert" className="p-5 text-sm">
                This document source is unavailable. Choose an accessible source.
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="m-5 rounded-md border border-red-300 bg-red-50 text-red-900 p-3 text-sm"
              >
                {error}
              </div>
            )}
            {notice && (
              <p role="status" className="px-6 pt-4 text-sm text-[var(--muted-foreground)]">
                {notice}
              </p>
            )}
            {loading ? (
              <p role="status" className="p-8 text-sm text-[var(--muted-foreground)]">
                Loading document…
              </p>
            ) : doc && sourceMatches ? (
              <>
                <div className="border-b border-[var(--border)] px-5 py-3 flex flex-wrap justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">
                      {index ? sourceLabel(index) : "Document source"}
                      {index && !index.canEdit ? " · Read only" : ""}
                    </p>
                    {(!sourceHasTitle || editing) && (
                      <h2 className="text-base font-semibold break-words">{doc.title}</h2>
                    )}
                    <p className="text-xs text-[var(--muted-foreground)] break-all">
                      {doc.path}
                      {dirty ? " · Unsaved changes" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <Button variant="outline" disabled={saving || creating} onClick={cancel}>
                          Cancel
                        </Button>
                        <Button disabled={saving || creating || !dirty || conflict} onClick={save}>
                          {saving ? "Saving…" : "Save changes"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={creating || createOpen || !index?.canEdit}
                        onClick={() => {
                          setEditing(true);
                          setNotice("");
                        }}
                      >
                        <Pencil size={14} /> Edit source
                      </Button>
                    )}
                  </div>
                </div>
                {conflict && (
                  <div
                    role="alert"
                    className="m-5 rounded-md border border-amber-300 bg-amber-50 text-amber-950 p-4 text-sm space-y-3"
                  >
                    <p className="font-semibold">The source changed since you opened it.</p>
                    <p>
                      Your edits are still here. Review the latest source and merge any changes into
                      your draft before saving again.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={reviewLatest}>
                        Review latest source
                      </Button>
                      <Button variant="outline" onClick={downloadDraft}>
                        Download my draft
                      </Button>
                    </div>
                    {latest && (
                      <>
                        <details open>
                          <summary className="cursor-pointer font-medium">
                            Latest source (read only)
                          </summary>
                          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs">
                            {latest.content}
                          </pre>
                        </details>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDoc(latest);
                            setConflict(false);
                            setLatest(null);
                            setNotice(
                              "Latest revision accepted. Review your draft, then save your merged changes."
                            );
                          }}
                        >
                          I have merged the latest changes
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <div
                  className="p-5 md:p-8"
                  data-color-mode={resolvedTheme === "dark" ? "dark" : "light"}
                >
                  {editing ? (
                    <>
                      <p className="text-xs text-[var(--muted-foreground)] mb-3">
                        Markdown source · Changes are saved only when you choose Save changes.
                      </p>
                      <MDEditor
                        value={draft}
                        onChange={(value) => setDraft(value ?? "")}
                        preview="edit"
                        height={520}
                        hideToolbar
                        visibleDragbar={false}
                        textareaProps={{
                          "aria-label": "Document Markdown source",
                          disabled: saving || creating,
                        }}
                      />
                    </>
                  ) : (
                    <DocumentMarkdown content={doc.content} path={doc.path} hrefFor={hrefFor} />
                  )}
                </div>
              </>
            ) : (
              !error && (
                <p className="p-8 text-sm text-[var(--muted-foreground)]">
                  Select a document to begin.
                </p>
              )
            )}
          </section>
        </div>
      )}
    </main>
  );
}
