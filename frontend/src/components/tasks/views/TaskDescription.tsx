import React, { useEffect, useState, useCallback, useMemo } from "react";
import MDEditor from "@uiw/react-md-editor";
import { DangerouslyHTMLComment } from "@/components/common/DangerouslyHTMLComment";
import { useTheme } from "next-themes";

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

  useEffect(() => {
    if (resolvedTheme) {
      setColorMode(resolvedTheme as "light" | "dark");
    }
  }, [resolvedTheme]);

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
              <MDEditor.Markdown
                key={`content-${idx}`}
                source={part}
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
      <div className="space-y-4 border-none" data-color-mode={colorMode}>
        <MDEditor
          value={value || ""}
          onChange={(val) => onChange(val || "")}
          hideToolbar={false}
          className="task-md-editor"
          textareaProps={{
            placeholder: "Describe the task in detail...",
            className:
              "bg-[var(--background)] text-[var(--foreground)] border-none focus:outline-none",
          }}
          height={420}
          preview="edit"
          visibleDragbar={false}
          commandsFilter={(command) => (command && command.name === "live" ? false : command)}
        />
      </div>
    );
  }

  return (
    <div
      className="task-description-view prose max-w-none bg-[var(--background)] text-sm text-[var(--foreground)] p-2 rounded-md border border-[var(--border)]"
      data-color-mode={colorMode}
    >
      {emailThreadId ? (
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
