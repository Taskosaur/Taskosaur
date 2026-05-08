"use client";

import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle,useMemo } from "react";
import dynamic from "next/dynamic";
import DOMPurify from "dompurify";
import {
  HiBold,
  HiItalic,
  HiUnderline,
  HiStrikethrough,
  HiOutlineListBullet,
  HiCodeBracket,
  HiCodeBracketSquare,
  HiDocumentText,
  HiOutlinePhoto,
} from "react-icons/hi2";
import { List, Quote } from "lucide-react";
import { toast } from "sonner";
import {
  handleImageUpload,
  generateUploadPlaceholderId,
  isUploadingPlaceholder,
  IMAGE_UPLOAD_CONFIG,
} from "@/lib/image-upload";

// Tiptap imports
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { UploadPlaceholder } from "@/lib/tiptap/upload-placeholder";
import Mention from "@tiptap/extension-mention";
import getMentionSuggestion from "./mention/suggestion";
import UserAvatar from "@/components/ui/avatars/UserAvatar";

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export type EditorMode = "markdown" | "richtext";

const EDITOR_MODE_STORAGE_KEY = "taskosaur_comment_editor_mode";

// Track ongoing uploads by placeholder ID
const ongoingUploads = new Map<string, boolean>();

const MENTION_STYLE = `
  .mention {
    color: #3b82f6 !important;
    font-weight: 500 !important;
    text-decoration: underline !important;
    cursor: pointer !important;
  }
  .dark .mention {
    color: #60a5fa !important;
  }
`;

// Inline styles configuration
const INLINE_STYLES = [
  { icon: <HiBold className="size-4" />, style: "BOLD", tooltip: "Bold (Ctrl+B)" },
  { icon: <HiItalic className="size-4" />, style: "ITALIC", tooltip: "Italic (Ctrl+I)" },
  { icon: <HiUnderline className="size-4" />, style: "UNDERLINE", tooltip: "Underline (Ctrl+U)" },
  { icon: <HiStrikethrough className="size-4" />, style: "STRIKETHROUGH", tooltip: "Strikethrough" },
] as const;

// Block types configuration
const BLOCK_TYPES = [
  { icon: <span className="text-xs font-semibold">H1</span>, style: "header-one", tooltip: "Heading 1" },
  { icon: <span className="text-xs font-semibold">H2</span>, style: "header-two", tooltip: "Heading 2" },
  { icon: <span className="text-xs font-semibold">H3</span>, style: "header-three", tooltip: "Heading 3" },
  { icon: <HiOutlineListBullet className="size-4" />, style: "unordered-list-item", tooltip: "Bullet List" },
  { icon: <List className="size-4" />, style: "ordered-list-item", tooltip: "Numbered List" },
  { icon: <Quote className="size-4" />, style: "blockquote", tooltip: "Quote" },
  { icon: <HiCodeBracket className="size-4" />, style: "code-block", tooltip: "Code Block" },
] as const;

export interface DualModeEditorHandle {
  clear: () => void;
  getContent: () => string;
  getRawContent: () => string;
}

interface DualModeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  colorMode?: "light" | "dark";
  disabled?: boolean;
  onModeChange?: (mode: EditorMode) => void;
  mentions?: any[];
}

/**
 * Get stored editor mode preference from localStorage
 */
function getStoredEditorMode(): EditorMode {
  if (typeof window === "undefined") return "markdown";
  try {
    const stored = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    if (stored === "markdown" || stored === "richtext") {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "markdown";
}

/**
 * Save editor mode preference to localStorage
 */
function saveEditorMode(mode: EditorMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Convert markdown to HTML (basic conversion for switching modes)
 */
function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  let html = markdown
    // Headers
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    // Strikethrough
    .replace(/~~(.*?)~~/g, "<del>$1</del>")
    // Code blocks
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    // Inline code
    .replace(/`(.*?)`/g, "<code>$1</code>")
    // Unordered lists
    .replace(/^\s*[-*+]\s+(.*$)/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\s*\d+\.\s+(.*$)/gm, "<li>$1</li>")
    // Blockquotes
    .replace(/^>\s*(.*$)/gm, "<blockquote>$1</blockquote>")
    .replace(/\[(.*?)\]\((.*?)\)/g, (match, label, url) => {
      if ((url.includes('/members') || url.includes('/users')) && label.startsWith('@')) {
        const id = url.split('/').pop();
        return `<a class="mention text-blue-500 font-medium cursor-pointer hover:underline" href="${url}" data-type="mention" data-id="${id}">${label}</a>`;
      }
      return `<a href="${url}">${label}</a>`;
    })
    // Support for @[mention:UUID] format
    .replace(/@\[mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi, (match, uuid) => {
      const workspaceSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '';
      return `<a class="mention text-blue-500 font-medium cursor-pointer hover:underline" href="/${workspaceSlug}/members/${uuid}" data-type="mention" data-id="${uuid}">@user</a>`;
    })
    // Line breaks
    .replace(/\n/g, "<br>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<br>)?)+/g, (match) => {
    const items = match.replace(/<br>/g, "");
    return `<ul>${items}</ul>`;
  });

  // Clean up extra <br> tags
  html = html.replace(/<br><br>/g, "</p><p>");

  if (!html.startsWith("<")) {
    html = `<p>${html}</p>`;
  }

  return html;
}

/**
 * Convert HTML to markdown (basic conversion for switching modes)
 */
function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let markdown = html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n")
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n")
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n")
    // Bold
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, "**$2**")
    // Italic
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, "*$2*")
    // Strikethrough
    .replace(/<(del|s|strike)[^>]*>(.*?)<\/(del|s|strike)>/gi, "~~$2~~")
    // Code blocks
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```")
    // Inline code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    // List items
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    // Remove ul/ol wrappers
    .replace(/<\/?[uo]l[^>]*>/gi, "")
    // Blockquotes
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n")
    // Mentions
    .replace(/<a[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, id, label) => {
      return `@[mention:${id}]`;
    })
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, href, label) => {
      if (href.includes('/members/') && label.startsWith('@')) {
        const id = href.split('/').pop();
        return `@[mention:${id}]`;
      }
      return `[${label}](${href})`;
    })
    // Paragraphs and line breaks
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // Remove remaining HTML tags safely using DOMPurify
  markdown = DOMPurify.sanitize(markdown, { ALLOWED_TAGS: [] });

  // Clean up extra whitespace
  markdown = markdown
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return markdown;
}

// Rich text editor inner component (Tiptap-based)
interface RichTextEditorInnerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  height: number;
  disabled: boolean;
  mentions?: any[];
}

function RichTextEditorInner({
  value,
  onChange,
  placeholder,
  height,
  disabled,
  mentions = [],
}: RichTextEditorInnerProps) {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedHtml = useRef<string>(value);
  const [isDragOver, setIsDragOver] = useState(false);

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      UploadPlaceholder,
      Mention.configure({
        HTMLAttributes: {
          class: "mention text-blue-500 font-medium cursor-pointer hover:underline",
        },
        renderHTML({ options, node }) {
          const workspaceSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '';
          return [
            "a",
            { ...options.HTMLAttributes, href: `/${workspaceSlug}/members/${node.attrs.id || node.attrs.label}`, "data-type": "mention", "data-id": node.attrs.id || node.attrs.label },
            `@${node.attrs.label}`,
          ];
        },
        suggestion: getMentionSuggestion(mentions),
      }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false, // Prevent SSR hydration mismatches
    editorProps: {
      attributes: {
        class: "tiptap-rich-editor prose prose-sm max-w-none focus:outline-none px-3 py-2 text-sm text-[var(--foreground)]",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // Normalize empty paragraph to empty string
      const emitted = html === "<p></p>" ? "" : html;
      lastEmittedHtml.current = emitted;
      onChange(emitted);
    },
  });

  // Sync external value changes (form reset, mode switch, clear after submit)
  useEffect(() => {
    if (!editor) return;
    const incoming = value || "";
    const current = lastEmittedHtml.current;
    
    // Only push new content when it truly differs (avoids cursor jump on every keystroke)
    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
      lastEmittedHtml.current = incoming;
    }
  }, [value, editor]);

  // Toggle disabled state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleRichTextImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;

      const placeholderId = generateUploadPlaceholderId();

      // Insert placeholder immediately
      editor.chain().focus().setUploadPlaceholder(placeholderId, file.name).run();

      // Upload in background
      const imageUrl = await handleImageUpload(file, {
        showToasts: false,
      });

      if (imageUrl) {
        // Remove placeholder and insert real image
        editor
          .chain()
          .focus()
          .removeUploadPlaceholder(placeholderId)
          .setImage({ src: imageUrl, alt: file.name })
          .run();

        toast.success("Image uploaded successfully", { description: file.name });
      } else {
        // Remove placeholder on failure
        editor.chain().focus().removeUploadPlaceholder(placeholderId).run();
        toast.error("Image upload failed", { description: file.name });
      }
    },
    [editor]
  );

  // ── Paste handler ─────────────────────────────────────────────────────────
  const handleRichTextPaste = useCallback(
    async (event: React.ClipboardEvent) => {
      const items = event.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        for (const file of imageFiles) {
          await handleRichTextImageUpload(file);
        }
      }
    },
    [handleRichTextImageUpload]
  );

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  const handleRichTextDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(event.dataTransfer.files);
      const imageFiles = files.filter((f): f is File =>
        IMAGE_UPLOAD_CONFIG.allowedTypes.includes(f.type as (typeof IMAGE_UPLOAD_CONFIG.allowedTypes)[number])
      );

      for (const file of imageFiles) {
        await handleRichTextImageUpload(file);
      }
    },
    [handleRichTextImageUpload]
  );

  const handleRichTextDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleRichTextDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // ── Toolbar file input ────────────────────────────────────────────────────
  const handleRichTextFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!IMAGE_UPLOAD_CONFIG.allowedTypes.includes(file.type as (typeof IMAGE_UPLOAD_CONFIG.allowedTypes)[number])) {
        toast.error("Invalid file type", {
          description: "Only JPEG, PNG, GIF, and WebP images are allowed.",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      await handleRichTextImageUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleRichTextImageUpload]
  );

  const handleRichTextImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ── Toolbar active-state helpers ──────────────────────────────────────────
  const isActive = (type: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(type, attrs) ?? false;

  const toolbarBtn = (active: boolean, disabled_: boolean) =>
    `p-1.5 rounded transition-colors ${
      active
        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
    } ${disabled_ ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`;

  // Loading state
  if (!editor) {
    return (
      <div
        className="rounded-md border border-[var(--border)] bg-[var(--background)] flex items-center justify-center"
        style={{ height }}
      >
        <span className="text-[var(--muted-foreground)] text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-[var(--border)] bg-[var(--muted)]/30">

        {/* ── Inline styles ── */}
        <button type="button" title="Bold (Ctrl+B)" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={toolbarBtn(isActive("bold"), disabled)}>
          <HiBold className="size-4" />
        </button>
        <button type="button" title="Italic (Ctrl+I)" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={toolbarBtn(isActive("italic"), disabled)}>
          <HiItalic className="size-4" />
        </button>
        <button type="button" title="Underline (Ctrl+U)" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          className={toolbarBtn(isActive("underline"), disabled)}>
          <HiUnderline className="size-4" />
        </button>
        <button type="button" title="Strikethrough" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
          className={toolbarBtn(isActive("strike"), disabled)}>
          <HiStrikethrough className="size-4" />
        </button>

        <span className="w-px h-5 bg-[var(--border)] mx-1" />

        {/* ── Block types ── */}
        <button type="button" title="Heading 1" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
          className={toolbarBtn(isActive("heading", { level: 1 }), disabled)}>
          <span className="text-xs font-semibold">H1</span>
        </button>
        <button type="button" title="Heading 2" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
          className={toolbarBtn(isActive("heading", { level: 2 }), disabled)}>
          <span className="text-xs font-semibold">H2</span>
        </button>
        <button type="button" title="Heading 3" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
          className={toolbarBtn(isActive("heading", { level: 3 }), disabled)}>
          <span className="text-xs font-semibold">H3</span>
        </button>
        <button type="button" title="Bullet List" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          className={toolbarBtn(isActive("bulletList"), disabled)}>
          <HiOutlineListBullet className="size-4" />
        </button>
        <button type="button" title="Numbered List" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          className={toolbarBtn(isActive("orderedList"), disabled)}>
          <List className="size-4" />
        </button>
        <button type="button" title="Quote" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
          className={toolbarBtn(isActive("blockquote"), disabled)}>
          <Quote className="size-4" />
        </button>
        <button type="button" title="Code Block" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }}
          className={toolbarBtn(isActive("codeBlock"), disabled)}>
          <HiCodeBracket className="size-4" />
        </button>

        <span className="w-px h-5 bg-[var(--border)] mx-1" />

        {/* ── Image upload ── */}
        <button type="button" title="Upload image" disabled={disabled}
          onClick={handleRichTextImageButtonClick}
          className={toolbarBtn(false, disabled)}>
          <HiOutlinePhoto className="size-4" />
        </button>
        <input ref={fileInputRef} type="file"
          accept={IMAGE_UPLOAD_CONFIG.allowedTypes.join(",")}
          onChange={handleRichTextFileChange}
          className="hidden" disabled={disabled} />
      </div>

      {/* Editor area */}
      <div
        className="overflow-y-auto relative flex flex-col"
        style={{ height: height - 45 }}
        onPaste={handleRichTextPaste}
        onDrop={handleRichTextDrop}
        onDragOver={handleRichTextDragOver}
        onDragLeave={handleRichTextDragLeave}
        onClick={(e) => {
          if ((e.target as HTMLElement).classList?.contains('tiptap-wrapper')) {
            editor.commands.focus('end');
          }
        }}
      >
        {/* Drop zone overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-md flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg">
              <HiOutlinePhoto className="size-6 mx-auto mb-1 text-blue-500" />
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Drop image to upload</p>
            </div>
          </div>
        )}

        <EditorContent editor={editor} className="tiptap-wrapper flex-grow flex flex-col cursor-text min-h-full" />
      </div>
    </div>
  );
}

const DualModeEditor = forwardRef<DualModeEditorHandle, DualModeEditorProps>(function DualModeEditor({
  value,
  onChange,
  placeholder = "Write your comment...",
  height = 200,
  colorMode = "light",
  disabled = false,
  onModeChange,
  mentions = [],
}, ref) {
  const [mode, setMode] = useState<EditorMode>("markdown");
  const [markdownValue, setMarkdownValue] = useState<string>("");
  const [richTextValue, setRichTextValue] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contentVersion, setContentVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processForLoad = useCallback((content: string) => {
    if (!content) return "";
    const workspaceSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'workspace';

    // 1. Handle internal format @[mention:UUID] -> [@username](/workspace/members)
    let processed = content.replace(/@\[mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi, (match, uuid) => {
      const mention = mentions.find(m => m.id === uuid);
      const label = mention ? mention.label : 'user';
      return `[@${label}](/${workspaceSlug}/members)`;
    });

    // 2. Handle legacy link formats [@username](/any/path/UUID) -> [@username](/workspace/members)
    // This ensures old comments are modernized in the editor and UUIDs are hidden
    processed = processed.replace(/\[@([\w.-]+)\]\(.*\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi, (match, label, uuid) => {
      const mention = mentions.find(m => m.id === uuid);
      const currentLabel = mention ? mention.label : label;
      return `[@${currentLabel}](/${workspaceSlug}/members)`;
    });

    // 3. Handle plain text mentions @username -> [@username](/workspace/members)
    // This catches very old mentions that were stored as plain text
    processed = processed.replace(/(?<!\[)@([\w.-]+)\b/g, (match, username) => {
      const mention = mentions.find(m => m.label === username);
      if (mention) {
        return `[@${username}](/${workspaceSlug}/members)`;
      }
      return match;
    });

    return processed;
  }, [mentions]);

  const processForSave = useCallback((content: string) => {
    if (!content) return "";
    
    // 1. Handle ALL link formats [@username](ANY_URL) 
    // This catches [@username](/workspace/members), [@username](/members/username), etc.
    let processed = content.replace(/\[@([\w.-]+)\]\(([^)]*)\)/g, (match, username, url) => {
      // If it's one of our mention links (contains /members or #)
      if (url.includes('/members') || url === '#') {
        // Try to find a UUID in the URL first (legacy support)
        const uuidMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (uuidMatch) {
          return `@[mention:${uuidMatch[1]}]`;
        }

        // Otherwise, look up the current ID by the username in the brackets
        const mention = mentions.find(m => m.label === username);
        if (mention) {
          return `@[mention:${mention.id}]`;
        }
      }
      return match;
    });

    // 2. Handle plain text mentions @username -> @[mention:UUID]
    // This catches anything that was missed by the link pattern
    processed = processed.replace(/(?<!\[)@([\w.-]+)\b/g, (match, username) => {
      const mention = mentions.find(m => m.label === username);
      if (mention) {
        return `@[mention:${mention.id}]`;
      }
      return match;
    });

    return processed;
  }, [mentions]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      setMarkdownValue("");
      setRichTextValue("");
      setContentVersion(prev => prev + 1);
      onChange("");
    },
    getContent: () => {
      const rawContent = mode === "markdown" ? markdownValue : richTextValue;
      return processForSave(rawContent);
    },
    getRawContent: () => {
      return mode === "markdown" ? markdownValue : richTextValue;
    }
  }), [onChange, mode, markdownValue, richTextValue, processForSave]);

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true);
    const storedMode = getStoredEditorMode();
    setMode(storedMode);
    onModeChange?.(storedMode);
  }, []);

  // Initialize editor with the provided value and handle external updates
  const prevValueRef = useRef<string>("");

  useEffect(() => {
    if (isMounted) {
      // Only update if the value has actually changed from what we have stored
      // This prevents loops when the update comes from the editor itself
      const currentStoredValue = mode === "markdown" ? markdownValue : richTextValue;

      // Detect if content is being cleared after having content (form submission)
      const prevValue = prevValueRef.current;
      const hadContent = prevValue !== "" && prevValue !== "<p></p>";
      const nowEmpty = value === "" || value === "<p></p>";

      if (hadContent && nowEmpty) {
        // Content was cleared - force remount to clear stale state
        // First, clear the stored values
        setMarkdownValue("");
        setRichTextValue("");
        // Then increment version to trigger remount
        setContentVersion(prev => prev + 1);
      }

      prevValueRef.current = value || "";

      // If the incoming value is different from what we have, update our state
      if (!isInitialized || value !== currentStoredValue) {
        if (value) {
          // Detect if value is HTML or markdown
          const isHtml = /<[a-z][\s\S]*>/i.test(value);

          if (mode === "markdown") {
            setMarkdownValue(processForLoad(isHtml ? htmlToMarkdown(value) : value));
            setRichTextValue(isHtml ? value : markdownToHtml(value));
          } else {
            setRichTextValue(isHtml ? value : markdownToHtml(value));
            setMarkdownValue(processForLoad(isHtml ? htmlToMarkdown(value) : value));
          }
        } else if (!isInitialized) {
          // Only reset to empty on init
          setMarkdownValue("");
          setRichTextValue("");
        } else if (value === "") {
           // Explicit clear from parent (but not the submission clear we handled above)
           if (!hadContent || !nowEmpty) {
             setMarkdownValue("");
             setRichTextValue("");
           }
        }

        if (!isInitialized) {
          setIsInitialized(true);
        }
      }
    }
  }, [value, mode, isInitialized, isMounted]);

  const [markdownMention, setMarkdownMention] = useState<{ active: boolean; text: string; startPos: number; } | null>(null);
  const [selectedMarkdownMentionIndex, setSelectedMarkdownMentionIndex] = useState(0);

  // Handle markdown editor change
  const handleMarkdownChange = useCallback(
    (val: string | undefined, event?: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = val || "";
      setMarkdownValue(newValue);
      onChange(newValue);

      // Check for mentions if we type or backspace
      const textarea = event?.target || document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
      if (textarea) {
        const cursorPos = textarea.selectionEnd;
        const textBeforeCursor = newValue.substring(0, cursorPos);
        const match = textBeforeCursor.match(/(?:^|\s|>|\[)@([\w.-]*)$/);
        
        if (match) {
          setMarkdownMention({ active: true, text: match[1], startPos: cursorPos - match[1].length });
          setSelectedMarkdownMentionIndex(0);
        } else {
          setMarkdownMention(null);
        }
      }
    },
    [onChange]
  );

  const filteredMentions = useMemo(() => {
    if (!markdownMention || !mentions) return [];
    return mentions.filter(m => m.label.toLowerCase().includes(markdownMention.text.toLowerCase())).slice(0, 5);
  }, [markdownMention, mentions]);

  const insertMarkdownMention = useCallback((mention: any) => {
    if (!markdownMention) return;
    
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    const workspaceSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '';
    
    const replaceStart = Math.max(0, markdownMention.startPos - 1);
    
    const beforeText = markdownValue.substring(0, replaceStart);
    
    const mentionText = `[@${mention.label}](/${workspaceSlug}/members) `;
    
    const currentPos = textarea ? textarea.selectionEnd : markdownValue.length;
    const afterText = markdownValue.substring(currentPos);
    
    const newText = beforeText + mentionText + afterText;
    setMarkdownValue(newText);
    onChange(newText);
    setMarkdownMention(null);
    
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newCursorPos = beforeText.length + mentionText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  }, [markdownMention, markdownValue, onChange]);

  const handleMarkdownKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!markdownMention) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMarkdownMentionIndex((prev) => (prev + 1) % Math.max(1, filteredMentions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMarkdownMentionIndex((prev) => (prev - 1 + filteredMentions.length) % Math.max(1, filteredMentions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMentions.length > 0) {
        insertMarkdownMention(filteredMentions[selectedMarkdownMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setMarkdownMention(null);
    }
  }, [markdownMention, filteredMentions, selectedMarkdownMentionIndex, insertMarkdownMention]);

  // Handle mode switching
  const handleModeSwitch = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return;

      if (newMode === "markdown") {
        // Convert rich text to markdown and clean it for display
        const markdown = htmlToMarkdown(richTextValue);
        const cleanMarkdown = processForLoad(markdown);
        setMarkdownValue(cleanMarkdown);
        onChange(processForSave(cleanMarkdown));
      } else {
        // Convert markdown to rich text and preserve UUIDs
        const fullMarkdown = processForSave(markdownValue);
        const html = markdownToHtml(fullMarkdown);
        setRichTextValue(html);
        onChange(html);
      }

      setMode(newMode);
      saveEditorMode(newMode);
      onModeChange?.(newMode);
    },
    [mode, richTextValue, markdownValue, onChange, onModeChange]
  );

  // Handle image upload and insert into markdown editor
  const handleImageUploadAndInsert = useCallback(async (file: File) => {
    const placeholderId = generateUploadPlaceholderId();
    const placeholderText = `![Uploading image...](uploading:${placeholderId})`;
    
    // Mark upload as in progress
    ongoingUploads.set(placeholderId, true);
    
    // Try to get cursor position from textarea, fallback to appending
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    let startPos = 0;
    let endPos = 0;
    
    if (textarea) {
      startPos = textarea.selectionStart;
      endPos = textarea.selectionEnd;
    }
    
    // Insert placeholder at cursor position or append
    const beforeText = markdownValue.substring(0, startPos);
    const afterText = markdownValue.substring(endPos);
    const needsNewlineBefore = beforeText.length > 0 && !beforeText.endsWith('\n');
    const needsNewlineAfter = afterText.length > 0 && !afterText.startsWith('\n');
    const newText = beforeText + (needsNewlineBefore ? '\n' : '') + placeholderText + (needsNewlineAfter ? '\n' : '') + afterText;
    
    setMarkdownValue(newText);
    onChange(newText);

    // Upload image
    const imageUrl = await handleImageUpload(file, {
      onProgress: (progress) => {
        // Optional: Update placeholder with progress
        if (ongoingUploads.has(placeholderId)) {
          const progressText = `![Uploading image... ${progress}%](uploading:${placeholderId})`;
          const updatedText = newText.replace(placeholderText, progressText);
          setMarkdownValue(updatedText);
          onChange(updatedText);
        }
      },
      showToasts: false,
    });

    // Remove from ongoing uploads
    ongoingUploads.delete(placeholderId);

    if (imageUrl) {
      // Replace placeholder with actual image markdown
      const finalText = newText.replace(placeholderText, `![${file.name}](${imageUrl})`);
      setMarkdownValue(finalText);
      onChange(finalText);
      toast.success("Image uploaded successfully", { description: file.name });
    } else {
      // Remove placeholder on failure
      const finalText = newText.replace(placeholderText, '').replace(/\n\n/g, '\n');
      setMarkdownValue(finalText);
      onChange(finalText);
      toast.error("Image upload failed", { description: file.name });
    }
  }, [markdownValue, onChange]);

  // Handle file input change
  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!IMAGE_UPLOAD_CONFIG.allowedTypes.includes(file.type as any)) {
      toast.error("Invalid file type", { 
        description: "Only JPEG, PNG, GIF, and WebP images are allowed." 
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    await handleImageUploadAndInsert(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleImageUploadAndInsert]);

  // Trigger file input click
  const handleImageButtonClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // Attach paste and drop listeners to the markdown editor
  useEffect(() => {
    if (!isMounted || mode !== 'markdown') return;

    const editorContainer = document.querySelector('.task-md-editor');
    if (!editorContainer) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        for (const file of imageFiles) {
          await handleImageUploadAndInsert(file);
        }
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer?.files || []);
      const imageFiles = files.filter((file): file is File => 
        IMAGE_UPLOAD_CONFIG.allowedTypes.includes(file.type as any)
      );

      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          await handleImageUploadAndInsert(file);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    };

    const handleDragLeave = () => {
      setIsDragOver(false);
    };

    editorContainer.addEventListener('paste', handlePaste);
    editorContainer.addEventListener('drop', handleDrop);
    editorContainer.addEventListener('dragover', handleDragOver);
    editorContainer.addEventListener('dragleave', handleDragLeave);
    
    return () => {
      editorContainer.removeEventListener('paste', handlePaste);
      editorContainer.removeEventListener('drop', handleDrop);
      editorContainer.removeEventListener('dragover', handleDragOver);
      editorContainer.removeEventListener('dragleave', handleDragLeave);
    };
  }, [isMounted, mode, handleImageUploadAndInsert]);

  // Handle rich text editor change
  const handleRichTextChange = useCallback(
    (val: string) => {
      setRichTextValue(val);
      onChange(val);
    },
    [onChange]
  );

  // Show loading state during SSR
  if (!isMounted) {
    return (
      <div
        className="rounded-md border border-[var(--border)] bg-[var(--background)] flex items-center justify-center"
        style={{ height }}
      >
        <span className="text-[var(--muted-foreground)] text-sm">Loading...</span>
      </div>
    );
  }

    return (
      <div className="dual-mode-editor">
        <style dangerouslySetInnerHTML={{ __html: MENTION_STYLE }} />
        {/* Mode Switcher */}
        <div className="flex items-center gap-2 mb-2">
          <div className="inline-flex items-center p-0.5 bg-[var(--muted)]/50 rounded-md">
            <button
              type="button"
              onClick={() => handleModeSwitch("markdown")}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                mode === "markdown"
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <HiCodeBracketSquare className="size-3.5" />
              Markdown
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("richtext")}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                mode === "richtext"
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <HiDocumentText className="size-3.5" />
              Rich Text
            </button>
          </div>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {mode === "markdown" ? "Supports GFM" : "WYSIWYG"}
          </span>
        </div>

        {/* Editor Content */}
        {mode === "markdown" ? (
          <div
            key={contentVersion}
            data-color-mode={colorMode}
            className="task-md-editor relative"
          >
            {/* Custom Image Upload Button */}
            <div className="flex items-center gap-1 p-1 border-b border-[var(--border)] bg-[var(--muted)]/30">
              <button
                type="button"
                onClick={handleImageButtonClick}
                disabled={disabled}
                title="Upload image"
                className={`p-1.5 rounded transition-colors text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] ${
                  disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
              <HiOutlinePhoto className="size-4" />
            </button>
            <span className="text-[10px] text-[var(--muted-foreground)] ml-2">
              Paste or drag images to upload
            </span>
          </div>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_UPLOAD_CONFIG.allowedTypes.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
          />
          
          {/* Drop zone overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-md flex items-center justify-center z-50 pointer-events-none">
              <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg">
                <HiOutlinePhoto className="size-6 mx-auto mb-1 text-blue-500" />
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Drop image to upload</p>
              </div>
            </div>
          )}
          
          <MDEditor
            value={markdownValue}
            onChange={handleMarkdownChange}
            preview="edit"
            hideToolbar={false}
            height={height}
            textareaProps={{
              placeholder,
              disabled,
              onKeyDown: handleMarkdownKeyDown,
            }}
            visibleDragbar={false}
          />
          {markdownMention?.active && filteredMentions.length > 0 && (
            <div className="absolute z-50 bottom-full left-6 mb-1 bg-white dark:bg-[#1a1b1e] shadow-lg border border-[var(--border)] rounded-md overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto">
              {filteredMentions.map((item: any, index: number) => (
                <button
                  key={item.id || index}
                  onMouseDown={(e) => { 
                    e.preventDefault(); 
                    insertMarkdownMention(item); 
                  }}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm transition-colors ${
                    index === selectedMarkdownMentionIndex 
                      ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' 
                      : 'hover:bg-[var(--muted)] text-[var(--foreground)]'
                  }`}
                >
                  <UserAvatar 
                    user={{ 
                      firstName: item.label.split(' ')[0], 
                      lastName: item.label.split(' ')[1] || '',
                      avatar: item.avatar 
                    }} 
                    size="xs" 
                  />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <RichTextEditorInner
          key={contentVersion}
          value={richTextValue}
          onChange={handleRichTextChange}
          placeholder={placeholder}
          height={height}
          disabled={disabled}
          mentions={mentions}
        />
      )}
    </div>
  );
});
export default DualModeEditor;
