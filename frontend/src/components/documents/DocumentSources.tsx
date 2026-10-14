import DocumentList from "./DocumentList";
import {
  DocumentOwner,
  DocumentSource,
  documentHref,
  sourceHome,
  sourceLabel,
  sourceLineage,
} from "./documents-api";

interface Props {
  sources: DocumentSource[];
  localOwner: DocumentOwner | null;
  selectedOwner: Pick<DocumentOwner, "scope" | "ownerId">;
  path: string;
  search: string;
  category: string;
  workspace: string;
  project: string;
  task: string;
}
interface OwnerNode {
  owner: DocumentOwner;
  source?: DocumentSource;
  children: OwnerNode[];
}
const ownerKey = (owner: Pick<DocumentOwner, "scope" | "ownerId">) =>
  `${owner.scope}/${owner.ownerId}`;

export default function DocumentSources({
  sources,
  localOwner,
  selectedOwner,
  path,
  search,
  category,
  workspace,
  project,
  task,
}: Props) {
  const roots: OwnerNode[] = [];
  const parents: DocumentSource[] = [];
  const localKey = localOwner ? ownerKey(localOwner) : "";
  const localLineage = sources
    .map(sourceLineage)
    .find((lineage) => lineage.some((owner) => ownerKey(owner) === localKey));
  const parentKeys = new Set(
    localLineage
      ?.slice(
        0,
        localLineage.findIndex((owner) => ownerKey(owner) === localKey)
      )
      .map(ownerKey)
  );
  const selectedSource = sources.find((source) => ownerKey(source) === ownerKey(selectedOwner));
  const selectedKeys = new Set(selectedSource ? sourceLineage(selectedSource).map(ownerKey) : []);
  const visibleSources = category
    ? sources
        .map((source) => ({
          ...source,
          documents: source.documents.filter((document) =>
            category === "uncategorized" ? !document.category : document.category === category
          ),
        }))
        .filter((source) => source.documents.length)
    : sources;
  for (const source of visibleSources) {
    const lineage = sourceLineage(source);
    const localPosition = lineage.findIndex((owner) => ownerKey(owner) === localKey);
    // Without a registered local/descendant source, the API returns only ancestors.
    // These can include parent workspaces with the same scope as the current workspace.
    const isParent =
      parentKeys.has(ownerKey(source)) ||
      (!localLineage &&
        source.scope !== "project" &&
        (localOwner?.scope === "project" || localOwner?.scope === "workspace"));
    if (isParent) {
      parents.push(source);
      continue;
    }
    // Missing lineage stays a separate home; never infer relationships from names.
    let siblings = roots;
    let node: OwnerNode | undefined;
    for (const owner of localPosition >= 0 ? lineage.slice(localPosition) : [source]) {
      node = siblings.find((item) => ownerKey(item.owner) === ownerKey(owner));
      if (!node) {
        node = { owner, children: [] };
        siblings.push(node);
      }
      siblings = node.children;
    }
    if (node) node.source = source;
  }
  function documents(source: DocumentSource) {
    const selected = ownerKey(source) === ownerKey(selectedOwner);
    return (
      <>
        <DocumentList
          documents={source.documents}
          currentPath={selected ? path : ""}
          searching={!!search.trim()}
          expandAll={!!category}
          homeLabel={sourceHome(source)}
          hrefFor={(nextPath) => documentHref(workspace, project, nextPath, task, source)}
        />
        {!source.documents.length && (
          <p className="text-xs p-2 text-[var(--muted-foreground)]">
            {search.trim()
              ? "No matching documents in this home."
              : "No documents in this home yet."}
          </p>
        )}
        {source.truncated && (
          <p className="text-xs p-2 text-[var(--muted-foreground)]">
            Narrow your search to find more documents in this home.
          </p>
        )}
      </>
    );
  }
  function branch(node: OwnerNode) {
    const selected =
      ownerKey(node.owner) === ownerKey(selectedOwner) || selectedKeys.has(ownerKey(node.owner));
    const contents = (
      <>
        {node.source && documents(node.source)}
        {!!node.children.length && (
          <div className="ml-3 border-l border-[var(--border)] pl-2 space-y-2">
            {node.children
              .sort((a, b) => a.owner.ownerName.localeCompare(b.owner.ownerName))
              .map(branch)}
          </div>
        )}
      </>
    );
    return ownerKey(node.owner) === localKey ? (
      <div key={ownerKey(node.owner)}>
        <h2 className="px-2 py-2 text-sm font-semibold break-words">{sourceLabel(node.owner)}</h2>
        {contents}
      </div>
    ) : (
      <details key={ownerKey(node.owner)} open={selected || !!search.trim() || !!category}>
        <summary className="cursor-pointer rounded-md p-2 text-sm font-medium break-words hover:bg-[var(--muted)]">
          {sourceLabel(node.owner)}
        </summary>
        {contents}
      </details>
    );
  }
  return (
    <>
      {category && !visibleSources.length && (
        <p role="status" className="text-xs p-2 text-[var(--muted-foreground)]">
          No documents match this category{search.trim() ? " and search" : ""}.
        </p>
      )}
      {category && sources.some((source) => source.truncated) && (
        <p className="text-xs p-2 text-[var(--muted-foreground)]">
          Some documents could not be listed. Narrow your search to find more.
        </p>
      )}
      {roots.map(branch)}
      {!!parents.length && (
        <div className="border-t border-[var(--border)] pt-3 space-y-2">
          <h2 className="px-2 text-xs font-semibold text-[var(--muted-foreground)]">
            Parent guidance
          </h2>
          {parents.map((source) => (
            <details
              key={ownerKey(source)}
              open={ownerKey(source) === ownerKey(selectedOwner) || !!search.trim() || !!category}
            >
              <summary className="cursor-pointer rounded-md p-2 text-sm font-medium break-words hover:bg-[var(--muted)]">
                {sourceLabel(source)}
              </summary>
              {documents(source)}
            </details>
          ))}
        </div>
      )}
    </>
  );
}
