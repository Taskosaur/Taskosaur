import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveDocumentLink } from "./documents-api";
import MermaidDiagram from "./MermaidDiagram";
interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
}
const hastText = (node: HastNode): string =>
  node.type === "text" ? node.value || "" : node.children?.map(hastText).join("") || "";
interface MarkdownNode {
  type: string;
  value?: string;
  position?: { start: { line: number } };
  children?: MarkdownNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}
function headingAnchors() {
  return (tree: MarkdownNode) => {
    const used = new Set<string>();
    const headings: MarkdownNode[] = [];
    let aliases: Record<string, unknown> = {};
    const firstNode = tree.children?.[0];
    const firstLine =
      firstNode?.type === "html" && firstNode.position?.start.line === 1
        ? firstNode.value?.split(/\r?\n/)[0]
        : undefined;
    const metadata =
      firstLine && new TextEncoder().encode(firstLine).length <= 8192
        ? firstLine.match(/^\uFEFF?<!-- taskosaur: (\{.*\}) -->$/)
        : null;
    if (metadata) {
      try {
        const parsed: unknown = JSON.parse(metadata[1]);
        if (parsed && typeof parsed === "object" && "headingAliases" in parsed) {
          const value = parsed.headingAliases;
          if (value && typeof value === "object" && !Array.isArray(value))
            aliases = value as Record<string, unknown>;
        }
      } catch {
        // Invalid optional metadata does not prevent rendering the document.
      }
    }
    const text = (node: MarkdownNode): string =>
      node.value || node.children?.map(text).join("") || "";
    const visit = (node: MarkdownNode) => {
      if (node.type === "heading") {
        const base = text(node)
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, "")
          .replace(/\s/g, "-");
        let id = base;
        let suffix = 0;
        while (used.has(id)) id = `${base}-${++suffix}`;
        used.add(id);
        headings.push(node);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
    for (const [alias, target] of Object.entries(aliases)) {
      if (!/^[\p{L}\p{N}_-]+$/u.test(alias) || typeof target !== "string" || used.has(alias))
        continue;
      const heading = headings.find((node) => node.data?.hProperties?.id === target);
      if (!heading) continue;
      used.add(alias);
      heading.children?.unshift({
        type: "headingAlias",
        data: { hName: "span", hProperties: { id: alias } },
        children: [],
      });
    }
  };
}
interface Props {
  content: string;
  path: string;
  hrefFor: (path: string) => string;
}
function isExternal(href: string, origin: string): boolean {
  if (!origin) return false;
  try {
    return new URL(href).origin !== origin;
  } catch {
    return false;
  }
}
export default function DocumentMarkdown({ content, path, hrefFor }: Props) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className="text-sm leading-7 break-words [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-7 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_p]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-[var(--primary)] [&_a]:underline [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-[var(--muted)] [&_pre]:p-4 [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-[var(--muted-foreground)] [&_table]:block [&_table]:overflow-x-auto [&_th]:border [&_th]:p-2 [&_td]:border [&_td]:p-2 [&_hr]:my-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, headingAnchors]}
        skipHtml
        components={{
          a: ({ href = "", children }) => {
            const target = resolveDocumentLink(path, href);
            if (target)
              return (
                <Link
                  href={hrefFor(target) + (href.includes("#") ? href.slice(href.indexOf("#")) : "")}
                >
                  {children}
                </Link>
              );
            if (/^https?:\/\//i.test(href))
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                  {isExternal(href, origin) && (
                    <span className="ml-1 text-xs text-[var(--muted-foreground)]">↗ External</span>
                  )}
                </a>
              );
            if (/^(#|mailto:)/i.test(href)) return <a href={href}>{children}</a>;
            return <span title="This link is outside the document collection">{children}</span>;
          },
          pre: ({ node, children }) => {
            const code = node?.children[0];
            const classes =
              code?.type === "element" && code.tagName === "code" ? code.properties.className : [];
            if (Array.isArray(classes) && classes.includes("language-mermaid")) {
              const chart = code?.type === "element" ? hastText(code) : "";
              return <MermaidDiagram chart={chart.replace(/\n$/, "")} />;
            }
            return <pre>{children}</pre>;
          },
          img: ({ alt }) => (
            <span className="text-[var(--muted-foreground)]">[Image: {alt || "image"}]</span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
