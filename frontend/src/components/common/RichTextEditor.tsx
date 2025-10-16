"use client";

import React from "react";
import {
  Editor,
  EditorState,
  RichUtils,
  DraftInlineStyleType,
  DraftBlockType,
  ContentBlock,
  DefaultDraftBlockRenderMap,
} from "draft-js";
import "draft-js/dist/Draft.css";
import {
  HiBold,
  HiItalic,
  HiUnderline,
  HiStrikethrough,
  HiOutlineListBullet,
} from "react-icons/hi2";
import { List, Quote } from "lucide-react";
import Immutable from "immutable";

const blockRenderMap = Immutable.Map({
  "header-one": { element: "h1" },
  "header-two": { element: "h2" },
  "header-three": { element: "h3" },
  "header-four": { element: "h4" },
  "header-five": { element: "h5" },
  "header-six": { element: "h6" },
  blockquote: { element: "blockquote" },
});

const extendedBlockRenderMap = DefaultDraftBlockRenderMap.merge(blockRenderMap);

interface RichTextEditorProps {
  editorState: EditorState;
  onChange: (state: EditorState) => void;
  placeholder?: string;
}

const INLINE_STYLES: {
  icon: React.ReactNode;
  style: DraftInlineStyleType;
  tooltip: string;
}[] = [
  { icon: <HiBold />, style: "BOLD", tooltip: "Bold" },
  { icon: <HiItalic />, style: "ITALIC", tooltip: "Italic" },
  { icon: <HiUnderline />, style: "UNDERLINE", tooltip: "Underline" },
  {
    icon: <HiStrikethrough />,
    style: "STRIKETHROUGH",
    tooltip: "Strikethrough",
  },
];

const BLOCK_TYPES: {
  icon: React.ReactNode;
  style: DraftBlockType;
  tooltip: string;
}[] = [
  {
    icon: <span className="font-normal">H1</span>,
    style: "header-one",
    tooltip: "Heading 1",
  },
  {
    icon: <span className="font-normal">H2</span>,
    style: "header-two",
    tooltip: "Heading 2",
  },
  {
    icon: <span className="font-normal">H3</span>,
    style: "header-three",
    tooltip: "Heading 3",
  },
  {
    icon: <span className="font-normal">H4</span>,
    style: "header-four",
    tooltip: "Heading 4",
  },
  {
    icon: <span className="font-normal">H5</span>,
    style: "header-five",
    tooltip: "Heading 5",
  },
  {
    icon: <span className="font-normal">H6</span>,
    style: "header-six",
    tooltip: "Heading 6",
  },
  {
    icon: <HiOutlineListBullet />,
    style: "unordered-list-item",
    tooltip: "Unordered List",
  },
  {
    icon: <List className="w-4 h-4" />,
    style: "ordered-list-item",
    tooltip: "Ordered List",
  },
  {
    icon: <Quote className="w-4 h-4" />,
    style: "blockquote",
    tooltip: "Blockquote",
  },
];

export default function RichTextEditor({
  editorState,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const toggleInline = (inlineStyle: DraftInlineStyleType) => {
    onChange(RichUtils.toggleInlineStyle(editorState, inlineStyle));
  };

  const toggleBlock = (blockType: DraftBlockType) => {
    onChange(RichUtils.toggleBlockType(editorState, blockType));
  };

  const handleKeyCommand = (command: string): "handled" | "not-handled" => {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      onChange(newState);
      return "handled";
    }
    return "not-handled";
  };

  const currentStyle = editorState.getCurrentInlineStyle();
  const selection = editorState.getSelection();
  const currentBlockType = editorState
    .getCurrentContent()
    .getBlockForKey(selection.getStartKey())
    .getType();

  const blockStyleFn = (block: ContentBlock) => {
    switch (block.getType()) {
      case "header-one":
        return "text-3xl font-bold my-2";
      case "header-two":
        return "text-2xl font-semibold my-2";
      case "header-three":
        return "text-xl font-semibold my-1";
      case "header-four":
        return "text-lg font-medium my-1";
      case "header-five":
        return "text-base font-medium my-1";
      case "header-six":
        return "text-sm font-medium my-1";
      case "blockquote":
        return "border-l-4 border-gray-400 pl-4 italic text-gray-600 my-2";
      case "unordered-list-item":
        return "list-disc ml-5 my-1";
      case "ordered-list-item":
        return "list-decimal ml-5 my-1";
      case "code-block":
        return "bg-gray-100 font-mono p-2 rounded my-1";
      default:
        return "";
    }
  };

  return (
    <div className="rounded-md bg-[var(--background)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {INLINE_STYLES.map((type) => (
          <button
            key={type.tooltip}
            type="button"
            title={type.tooltip}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleInline(type.style);
            }}
            className={`p-2 rounded-md flex items-center justify-center cursor-pointer transition border ${
              currentStyle.has(type.style)
                ? "border-[var(--border)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-transparent text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {type.icon}
          </button>
        ))}

        <span className="text-[var(--muted-foreground)] mx-1">|</span>

        {BLOCK_TYPES.map((type) => (
          <button
            key={type.tooltip}
            type="button"
            title={type.tooltip}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlock(type.style);
            }}
            className={`p-2 rounded-md flex items-center justify-center cursor-pointer transition border ${
              currentBlockType === type.style
                ? "border-[var(--border)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-transparent text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {type.icon}
          </button>
        ))}
      </div>

      <hr className="border-t border-[var(--border)] mb-2" />

      {/* Editor */}
      <div className="relative w-full">
        <div className="h-40 w-full rounded-md bg-[var(--muted)]/30 px-3 py-2 text-sm font-normal leading-6 shadow-sm resize-y overflow-y-auto cursor-text whitespace-pre-wrap">
          <Editor
            editorState={editorState}
            onChange={onChange}
            blockRenderMap={extendedBlockRenderMap}
            placeholder={placeholder || "Type your text..."}
            handleKeyCommand={handleKeyCommand}
            blockStyleFn={blockStyleFn}
          />
        </div>
      </div>
    </div>
  );
}
