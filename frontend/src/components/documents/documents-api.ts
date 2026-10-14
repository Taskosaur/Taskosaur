import api from "@/lib/api";
import type { AxiosRequestConfig } from "axios";

export interface DocumentSummary {
  path: string;
  title: string;
  subjects?: string[];
  category?: "Coordination" | "Guidance" | "Knowledge" | "Capabilities" | "Operations";
}
export interface ProjectDocument extends DocumentSummary {
  content: string;
  revision: string;
  canonicalReference?: DocumentReference;
}
export interface DocumentIndex {
  label: string;
  entrypoint: string;
  documents: DocumentSummary[];
  truncated: boolean;
}
export type DocumentScope = "organization" | "workspace" | "project";
export interface DocumentReference {
  scope: DocumentScope;
  ownerId: string;
  path: string;
}
export interface DocumentOwner {
  scope: DocumentScope;
  ownerId: string;
  ownerName: string;
}
export interface DocumentSource extends DocumentIndex {
  scope: DocumentScope;
  ownerId: string;
  ownerName: string;
  canEdit: boolean;
  lineage: DocumentOwner[];
}
export const referenceKey = (ref: DocumentReference) => `${ref.scope}/${ref.ownerId}/${ref.path}`;
export const sourceLabel = (source: Pick<DocumentSource, "scope" | "ownerName">) =>
  `${source.scope[0].toUpperCase()}${source.scope.slice(1)} · ${source.ownerName}`;
export const sourceLineage = (source: DocumentSource): DocumentOwner[] =>
  source.lineage?.length ? source.lineage : [source];
export const sourceHome = (source: DocumentSource) =>
  sourceLineage(source).map(sourceLabel).join(" / ");
// Source files can change outside Taskosaur: never serve the API client's GET cache.
const fresh: AxiosRequestConfig & { _useCache: boolean } = { _useCache: false };
const createOnce: AxiosRequestConfig & { _skipErrorHandling: boolean } = {
  _skipErrorHandling: true,
};
const base = (ownerId: string, scope: DocumentScope = "project") =>
  `/${scope === "organization" ? "organizations" : scope === "workspace" ? "workspaces" : "projects"}/${encodeURIComponent(ownerId)}`;
export const documentsApi = {
  sources: async (
    ownerId: string,
    scope: DocumentScope = "project",
    q = "",
    includeChildren = false
  ) =>
    (
      await api.get<{ sources: DocumentSource[] }>(`${base(ownerId, scope)}/document-sources`, {
        ...fresh,
        params: { q, includeChildren },
      })
    ).data,
  create: async (
    projectId: string,
    document: { path: string; title: string },
    scope: DocumentScope = "project"
  ) =>
    (await api.post<ProjectDocument>(`${base(projectId, scope)}/document`, document, createOnce))
      .data,
  list: async (projectId: string, q = "", scope: DocumentScope = "project") =>
    (
      await api.get<DocumentIndex>(`${base(projectId, scope)}/documents`, {
        ...fresh,
        params: { q },
      })
    ).data,
  read: async (projectId: string, path: string, scope: DocumentScope = "project") =>
    (
      await api.get<ProjectDocument>(`${base(projectId, scope)}/document`, {
        ...fresh,
        params: { path },
      })
    ).data,
  save: async (
    projectId: string,
    document: Pick<ProjectDocument, "path" | "content" | "revision">,
    scope: DocumentScope = "project"
  ) => (await api.put<ProjectDocument>(`${base(projectId, scope)}/document`, document)).data,
  links: async (projectId: string, taskId: string) =>
    (
      await api.get<{ paths: string[]; references: DocumentReference[] }>(
        `${base(projectId)}/tasks/${encodeURIComponent(taskId)}/document-links`,
        fresh
      )
    ).data,
  setLinks: async (projectId: string, taskId: string, references: DocumentReference[]) =>
    (
      await api.put<{ paths: string[]; references: DocumentReference[] }>(
        `${base(projectId)}/tasks/${encodeURIComponent(taskId)}/document-links`,
        { references }
      )
    ).data,
};
export function documentFilename(title: string): string {
  const name = title
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
  const safeName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name) ? `document-${name}` : name;
  return `${safeName || "untitled"}.md`;
}
export function documentError(error: unknown): { status?: number; message: string } {
  const value = error as { status?: number; message?: string; response?: { status?: number } };
  return {
    status: value?.status ?? value?.response?.status,
    message: value?.message || "Something went wrong. Please try again.",
  };
}
export function documentHref(
  workspace: string,
  project: string,
  path?: string,
  taskId?: string,
  source?: Pick<DocumentSource, "scope" | "ownerId">
) {
  const query = new URLSearchParams();
  if (path) query.set("path", path);
  if (taskId) query.set("task", taskId);
  if (source) {
    query.set("scope", source.scope);
    query.set("ownerId", source.ownerId);
  }
  const route = project
    ? `/${encodeURIComponent(workspace)}/${encodeURIComponent(project)}/docs`
    : workspace
      ? `/${encodeURIComponent(workspace)}/docs`
      : "/organization/docs";
  return `${route}${query.size ? `?${query}` : ""}`;
}
export function resolveDocumentLink(currentPath: string, href: string): string | null {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(href)) return null;
  const withoutHash = href.split(/[?#]/)[0];
  if (!/\.md$/i.test(withoutHash)) return null;
  const parts = currentPath.split("/").slice(0, -1);
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutHash);
  } catch {
    return null;
  }
  for (const part of decoded.split("/")) {
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}
