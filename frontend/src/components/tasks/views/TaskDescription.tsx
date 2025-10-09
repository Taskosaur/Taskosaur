import React, { useEffect, useState, useCallback, useMemo } from "react";
import MDEditor from "@uiw/react-md-editor";
import { DangerouslyHTMLComment } from "@/components/common/DangerouslyHTMLComment";

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
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof document !== "undefined") {
      setColorMode(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    }
  }, []);

  // Create a mapping of checkbox indices to actual line numbers
  const checkboxLineMapping = useMemo(() => {
    if (!value) return [];

    const lines = value.split("\n");
    const taskLineRegex = /^(\s*-\s+)\[([x ])\](.*)$/i;
    const mapping: number[] = [];

    lines.forEach((line, lineIndex) => {
      console.log(`Line ${lineIndex}: "${line}"`);
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
      if (!md) return [];

      const lines = md.split("\n");
      const taskLineRegex = /^(\s*-\s+)\[([x ])\](.*)$/i;
      let checkboxIndex = 0;

      return lines.map((line, lineIndex) => {
        const match = line.match(taskLineRegex);
        if (match) {
          const [, prefix, mark, suffix] = match;
          const isChecked = mark.trim().toLowerCase() === "x";
          const currentCheckboxIndex = checkboxIndex;
          checkboxIndex++;

          return {
            type: "checkbox-line",
            prefix,
            suffix,
            isChecked,
            checkboxIndex: currentCheckboxIndex,
            originalLine: line,
            lineIndex,
          };
        }
        return {
          type: "regular-line",
          content: line,
          lineIndex,
        };
      });
    }, [md, checkboxStates]);

    return (
      <div className="markdown-content">
        {processedMarkdown.map((item, idx) => {
          if (item.type === "checkbox-line") {
            return (
              <div
                key={`checkbox-${item.lineIndex}-${idx}`}
                className="flex  mb-1"
              >
                {/* <span className="whitespace-pre">{item.prefix}</span> */}
                <input
                  type="checkbox"
                  checked={item.isChecked}
                  onChange={(e) => {
                    e.preventDefault();
                    handleCheckboxToggle(item.checkboxIndex);
                  }}
                  className="cursor-pointer mr-2 mt-0.5"
                />
                <span>{item.suffix}</span>
              </div>
            );
          } else if (item.content.trim()) {
            return (
              <MDEditor.Markdown
                key={`content-${item.lineIndex}-${idx}`}
                source={item.content}
                className="prose max-w-none"
              />
            );
          } else {
            return (
              <div key={`empty-${item.lineIndex}-${idx}`} className="h-4"></div>
            );
          }
        })}
      </div>
    );
  };

  if (editMode) {
    return (
      <div className="space-y-4" data-color-mode={colorMode}>
        <MDEditor
          value={value || ""}
          onChange={(val) => onChange(val || "")}
          hideToolbar={false}
          className="task-md-editor"
          textareaProps={{
            placeholder: "Describe the task in detail...",
            className:
              "bg-[var(--background)] text-[var(--foreground)] border-none h-[420px] focus:outline-none",
          }}
          height={520}
          preview="edit"
          commandsFilter={(command) =>
            command && command.name === "live" ? false : command
          }
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
