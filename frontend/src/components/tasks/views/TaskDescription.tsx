import React, { useEffect, useState, useCallback, useMemo } from "react";
import { DangerouslyHTMLComment } from "@/components/common/DangerouslyHTMLComment";
import { SafeMarkdownRenderer } from "@/components/common/SafeMarkdownRenderer";
import DualModeEditor, { EditorMode } from "@/components/common/DualModeEditor";
import { useTheme } from "next-themes";
import { HiExclamationTriangle } from "react-icons/hi2";

interface TaskDescriptionProps {
  value: string;
  onChange: (value: string) => void;
  editMode?: boolean;
  onSaveRequest?: (newValue: string) => void;
  emailThreadId?: boolean | null;
}

const TaskDescription: React.FC<TaskDescriptionProps> = ({
  value,
  onChange,
  editMode = true,
  onSaveRequest,
  emailThreadId,
}) => {
  const { resolvedTheme } = useTheme();
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [editorMode, setEditorMode] = useState<EditorMode>("markdown");

  useEffect(() => {
    if (resolvedTheme) {
      setColorMode(resolvedTheme as "light" | "dark");
    }
  }, [resolvedTheme]);

  // Handle mode change from DualModeEditor
  const handleModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
  }, []);

  const checkboxLineMapping = useMemo(() => {
    if (!value) return [];

    const lines = value.split("\n");
    const taskLineRegex = /^(\s*-\s+)\[([x ])\](.*)$/i;
    const mapping: number[] = [];

    lines.forEach((line, lineIndex) => {
      if (taskLineRegex.test(line)) {
        mapping.push(lineIndex);
      }
    });

    return mapping;
  }, [value]);

  const handleCheckboxToggle = useCallback(
    (checkboxIndex: number) => {
      const actualLineIndex = checkboxLineMapping[checkboxIndex];

      if (actualLineIndex === undefined || !value) {
        return;
      }

      const lines = value.split("\n");
      const taskLineRegex = /^(\s*-\s+)\[([x ])\](.*)$/i;

      const match = lines[actualLineIndex]?.match(taskLineRegex);
      if (!match) {
        return;
      }

      const [, prefix, currentMark, suffix] = match;
      const newMark = currentMark.trim().toLowerCase() === "x" ? " " : "x";
      lines[actualLineIndex] = `${prefix}[${newMark}]${suffix}`;

      const newValue = lines.join("\n");
      onChange(newValue);
      onSaveRequest?.(newValue);
    },
    [value, onChange, onSaveRequest, checkboxLineMapping]
  );

  // Extract checkbox states from markdown for proper indexing
  const checkboxStates = useMemo(() => {
    if (!value) return [];

    const lines = value.split("\n");
    const taskLineRegex = /^(\s*-\s+)\[([x ])\](.*)$/i;
    const states: boolean[] = [];

    lines.forEach((line) => {
      const match = line.match(taskLineRegex);
      if (match) {
        const [, , mark] = match;
        states.push(mark.trim().toLowerCase() === "x");
      }
    });

    return states;
  }, [value]);

  // Detect if content is HTML (from Rich Text editor) - must be before any early returns
  const isHtmlContent = useMemo(() => {
    if (!value) return false;
    const trimmed = value.trim();
    const startsWithBlockTag = /^<(p|div|h[1-6]|ul|ol|blockquote|pre)[^>]*>/i.test(trimmed);
    const endsWithBlockTag = /<\/(p|div|h[1-6]|ul|ol|blockquote|pre)>\s*$/i.test(trimmed);
    return startsWithBlockTag && endsWithBlockTag;
  }, [value]);

  // Custom markdown renderer that handles checkboxes properly
  const MarkdownWithInteractiveTasks: React.FC<{ md: string }> = ({ md }) => {
    const processedMarkdown = useMemo(() => {
      if (!md) return md;

      const lines = md.split("\n");
      const taskLineRegex = /^(\s*-\s+)\[([x ])\](.*)$/i;
      let checkboxIndex = 0;

      const processedLines = lines.map((line) => {
        const match = line.match(taskLineRegex);
        if (match) {
          const [, prefix, mark, suffix] = match;
          const currentCheckboxIndex = checkboxIndex;
          checkboxIndex++;

          // Replace checkbox with a unique placeholder that won't be rendered by markdown
          return `__CHECKBOX_${currentCheckboxIndex}__${mark}__${suffix}`;
        }
        return line;
      });

      return processedLines.join("\n");
    }, [md]);

    // Split content by checkbox placeholders and render appropriately
    const parts = processedMarkdown.split(/(__CHECKBOX_\d+__[x ]__.*?)(?=\n|$)/);

    return (
      <div className="markdown-content">
        {parts.map((part, idx) => {
          const checkboxMatch = part.match(/^__CHECKBOX_(\d+)__([x ])__(.*)$/);
          if (checkboxMatch) {
            const [, indexStr, mark, suffix] = checkboxMatch;
            const checkboxIndex = parseInt(indexStr, 10);
            const isChecked = mark.trim().toLowerCase() === "x";

            return (
              <div key={`checkbox-${checkboxIndex}-${idx}`} className="flex items-start mb-1">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    e.preventDefault();
                    handleCheckboxToggle(checkboxIndex);
                  }}
                  className="cursor-pointer mr-2 mt-1"
                />
                <span>{suffix}</span>
              </div>
            );
          } else if (part.trim()) {
            return (
              <SafeMarkdownRenderer
                key={`content-${idx}`}
                content={part}
                className="prose max-w-none"
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  if (editMode) {
    return (
      <div className="space-y-2">
        {/* Warning for Rich Text mode */}
        {editorMode === "richtext" && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
            <HiExclamationTriangle className="size-4 flex-shrink-0" />
            <span>Interactive checkboxes only work in Markdown mode. Use <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded">- [ ]</code> syntax for task lists.</span>
          </div>
        )}
        <DualModeEditor
          value={value || ""}
          onChange={onChange}
          placeholder="Describe the task in detail..."
          height={420}
          colorMode={colorMode}
          onModeChange={handleModeChange}
        />
      </div>
    );
  }

  return (
    <div
      className="task-description-view prose max-w-none bg-[var(--background)] text-sm text-[var(--foreground)] p-2 rounded-md border border-[var(--border)]"
      data-color-mode={colorMode}
    >
      {emailThreadId || isHtmlContent ? (
        <DangerouslyHTMLComment comment={value} />
      ) : value ? (
        <MarkdownWithInteractiveTasks md={value} />
      ) : (
        <div>No description provided</div>
      )}
    </div>
  );
};

export default TaskDescription;
