import { HiViewColumns } from "react-icons/hi2";

type ViewMode = "days" | "weeks" | "months";

// Header Controls Component
export const HeaderControls: React.FC<{
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isCompact: boolean;
  setIsCompact: (compact: boolean) => void;
  scrollToToday: () => void;
  taskCount: number;
}> = ({ viewMode, setViewMode, taskCount }) => (
  <div className="p-4 bg-[var(--card)] border-b border-[var(--border)]">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <HiViewColumns className="w-5 h-5 text-white" />
          </div>
          Project Timeline
        </h2>
        <p className="text-slate-600 dark:text-slate-400 font-medium">
          {taskCount} task{taskCount !== 1 ? "s" : ""} across your timeline
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-[var(--odd-row)] rounded-lg p-1 shadow-sm">
          {(["days", "weeks", "months"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize cursor-pointer ${
                viewMode === mode
                  ? "bg-blue-500 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-[var(--accent)]/50"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);
