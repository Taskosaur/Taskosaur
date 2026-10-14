import Link from "next/link";
import { FileText, Folder, ChevronRight } from "lucide-react";
import type { DocumentSummary } from "./documents-api";

interface DocumentFolder {
  name: string;
  label: string;
  path: string;
  folders: DocumentFolder[];
  documents: DocumentSummary[];
}

interface Props {
  documents: DocumentSummary[];
  currentPath: string;
  searching: boolean;
  expandAll?: boolean;
  hrefFor: (path: string) => string;
  homeLabel?: string;
}

function containsPath(folder: DocumentFolder, path: string): boolean {
  return (
    folder.documents.some((document) => document.path === path) ||
    folder.folders.some((child) => containsPath(child, path))
  );
}

export default function DocumentList({
  documents,
  currentPath,
  searching,
  expandAll = false,
  hrefFor,
  homeLabel,
}: Props) {
  const root: DocumentFolder = { name: "", label: "", path: "", folders: [], documents: [] };
  for (const document of documents) {
    let parent = root;
    const subjects = document.subjects ?? document.path.split("/").slice(0, -1);
    for (const name of subjects) {
      const path = `${parent.path}/${encodeURIComponent(name)}`;
      let folder = parent.folders.find((item) => item.name === name);
      if (!folder) {
        folder = {
          name,
          label: document.subjects
            ? name
            : name.replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
          path,
          folders: [],
          documents: [],
        };
        parent.folders.push(folder);
      }
      parent = folder;
    }
    parent.documents.push(document);
  }

  function contents(folder: DocumentFolder) {
    return (
      <>
        {folder.folders
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((child) => (
            <li key={child.path}>
              <details
                open={searching || expandAll || containsPath(child, currentPath)}
                className="[&[open]>summary>svg:first-child]:rotate-90"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-[var(--muted)] [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={14} className="shrink-0" />
                  <Folder size={15} className="shrink-0 text-[var(--muted-foreground)]" />
                  <span className="min-w-0 break-words">{child.label}</span>
                </summary>
                <ul className="ml-4 space-y-1 border-l border-[var(--border)] pl-2">
                  {contents(child)}
                </ul>
              </details>
            </li>
          ))}
        {folder.documents
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((item) => (
            <li key={item.path}>
              <Link
                href={hrefFor(item.path)}
                aria-current={item.path === currentPath ? "page" : undefined}
                className={`block rounded-md px-2 py-2 text-sm hover:bg-[var(--muted)] ${item.path === currentPath ? "bg-[var(--muted)] font-medium" : ""}`}
              >
                <span className="flex items-start gap-2">
                  <FileText size={15} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">
                    {item.title}
                    {searching && (
                      <span className="mt-0.5 block text-xs font-normal text-[var(--muted-foreground)]">
                        {item.path}
                        {searching && homeLabel ? ` · Home: ${homeLabel}` : ""}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
      </>
    );
  }

  return <ul className="space-y-1">{contents(root)}</ul>;
}
