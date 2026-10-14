import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  documentError,
  documentHref,
  documentsApi,
  DocumentSource,
  DocumentReference,
  referenceKey,
  sourceLabel,
} from "./documents-api";

interface Props {
  projectId: string;
  taskId: string;
  returnTaskId: string;
  workspaceSlug: string;
  projectSlug: string;
  canEdit: boolean;
}
export default function TaskDocumentLinks({
  projectId,
  taskId,
  returnTaskId,
  workspaceSlug,
  projectSlug,
  canEdit,
}: Props) {
  const [references, setReferences] = useState<DocumentReference[]>([]);
  const [sources, setSources] = useState<DocumentSource[]>([]);
  const [selected, setSelected] = useState<DocumentReference[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(true);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReferences([]);
    setOpen(false);
    setError("");
    setAvailable(true);
    documentsApi
      .links(projectId, taskId)
      .then((result) => {
        if (active)
          setReferences(
            result.references ||
              result.paths.map((path) => ({ scope: "project", ownerId: projectId, path }))
          );
      })
      .catch((err) => {
        if (active) {
          if (documentError(err).status === 404) setAvailable(false);
          else setError(documentError(err).message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, taskId]);
  useEffect(() => {
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(
      () => {
        documentsApi
          .sources(projectId, "project", query)
          .then((result) => {
            if (active) {
              setSources(result.sources);
              setTruncated(result.sources.some((source) => source.truncated));
              setAvailable(
                result.sources.some(
                  (source) => source.scope === "project" && source.ownerId === projectId
                )
              );
            }
          })
          .catch((err) => {
            if (active) {
              if (documentError(err).status === 404) setAvailable(false);
              else setError(documentError(err).message);
            }
          })
          .finally(() => {
            if (active) setSearching(false);
          });
      },
      query ? 200 : 0
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [projectId, query, open]);
  function labelFor(ref: DocumentReference) {
    const source = sources.find((item) => item.scope === ref.scope && item.ownerId === ref.ownerId);
    return source ? sourceLabel(source) : `${ref.scope[0].toUpperCase()}${ref.scope.slice(1)}`;
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await documentsApi.setLinks(projectId, taskId, selected);
      setReferences(
        result.references ||
          result.paths.map((path) => ({ scope: "project", ownerId: projectId, path }))
      );
      setOpen(false);
    } catch (err) {
      setError(documentError(err).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="my-5 border-t border-[var(--border)] pt-5" aria-label="Related context">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen size={16} /> Related context
        </h3>
        {canEdit && available && !open && (
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || !!error}
            onClick={() => {
              setSelected(references);
              setQuery("");
              setOpen(true);
            }}
          >
            <Plus size={14} /> Attach document
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        Documents linked to this task. Each link opens the current source.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]" role="status">
          Loading context…
        </p>
      ) : !available && !references.length ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Connect a document collection to this project before attaching documents.
        </p>
      ) : references.length ? (
        <ul className="mt-3 space-y-2">
          {references.map((ref) => (
            <li key={referenceKey(ref)}>
              <Link
                className="text-sm text-[var(--primary)] underline break-all"
                href={documentHref(workspaceSlug, projectSlug, ref.path, returnTaskId, ref)}
              >
                {labelFor(ref)} · {ref.path}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">No documents linked yet.</p>
      )}
      {open && (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Attach existing documents</h4>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close document picker"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </Button>
          </div>
          <Input
            aria-label="Find documents to attach"
            placeholder="Search documents…"
            value={query}
            disabled={saving}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!available ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Connect a document collection to this project before attaching documents.
            </p>
          ) : (
            <>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.map((ref) => (
                    <button
                      type="button"
                      key={referenceKey(ref)}
                      disabled={saving}
                      onClick={() =>
                        setSelected((items) =>
                          items.filter((item) => referenceKey(item) !== referenceKey(ref))
                        )
                      }
                      className="text-xs border border-[var(--border)] rounded px-2 py-1 break-all text-left"
                      aria-label={`Remove ${ref.scope} ${ref.path} from selection`}
                    >
                      {labelFor(ref)} - {ref.path} x
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-56 overflow-y-auto space-y-1">
                {sources.map((source) => (
                  <div key={`${source.scope}/${source.ownerId}`} className="pt-2">
                    <h5 className="text-xs font-semibold px-2 pb-1">{sourceLabel(source)}</h5>
                    {source.documents.map((item) => {
                      const ref: DocumentReference = {
                        scope: source.scope,
                        ownerId: source.ownerId,
                        path: item.path,
                      };
                      return (
                        <label
                          key={referenceKey(ref)}
                          className="flex items-start gap-2 p-2 rounded hover:bg-[var(--muted)] text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            disabled={saving}
                            checked={selected.some(
                              (value) => referenceKey(value) === referenceKey(ref)
                            )}
                            onChange={(event) =>
                              setSelected((items) =>
                                event.target.checked
                                  ? [...items, ref]
                                  : items.filter(
                                      (value) => referenceKey(value) !== referenceKey(ref)
                                    )
                              )
                            }
                          />
                          <span className="min-w-0 break-words">
                            {item.title}
                            <span className="block text-xs text-[var(--muted-foreground)] break-all">
                              {item.path}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
              {searching ? (
                <p role="status" className="text-xs">
                  Searching…
                </p>
              ) : (
                sources.every((source) => source.documents.length === 0) && (
                  <p className="text-sm text-[var(--muted-foreground)]">No matching documents.</p>
                )
              )}
              {truncated && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Narrow your search to see more documents.
                </p>
              )}
            </>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !available} onClick={save}>
              {saving ? "Saving…" : "Save links"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
