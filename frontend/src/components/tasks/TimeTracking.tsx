import React, { useState } from "react";
import { Task, TimeEntry } from "@/types/tasks";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { Button } from "@/components/ui";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

interface TimeTrackingProps {
  task: Task;
  onLogTime: (timeEntry: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">) => void;
  onUpdateTime: (timeEntryId: string, timeEntry: Partial<TimeEntry>) => void;
  onDeleteTime: (timeEntryId: string) => void;
}

export default function TimeTracking({
  task,
  onLogTime,
  onUpdateTime,
  onDeleteTime,
}: TimeTrackingProps) {
  const [showLogTime, setShowLogTime] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<TimeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const [timeLogData, setTimeLogData] = useState({
    timeSpent: 0,
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [editData, setEditData] = useState({
    timeSpent: 0,
    description: "",
    date: "",
  });

  // Timer functionality
  const startTimer = () => {
    setIsTimerRunning(true);
    setTimerStart(new Date());
    setTimerElapsed(0);
  };

  const stopTimer = () => {
    if (timerStart) {
      const elapsed = Math.floor((new Date().getTime() - timerStart.getTime()) / 1000 / 60); // minutes
      setTimerElapsed(elapsed);
      setIsTimerRunning(false);
      setTimeLogData((prev) => ({ ...prev, timeSpent: elapsed }));
      setShowLogTime(true);
    }
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerStart(null);
    setTimerElapsed(0);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTotalTimeSpent = () => {
    return task.timeEntries?.reduce((total, entry) => total + entry.timeSpent, 0) || 0;
  };

  const getTimeRemaining = () => {
    const totalSpent = getTotalTimeSpent();
    const estimated = task.originalEstimate || 0;
    return Math.max(0, estimated - totalSpent);
  };

  const getProgressPercentage = () => {
    const totalSpent = getTotalTimeSpent();
    const estimated = task.originalEstimate || 0;
    if (estimated === 0) return 0;
    return Math.min(100, (totalSpent / estimated) * 100);
  };

  const handleLogTime = () => {
    if (timeLogData.timeSpent > 0) {
      onLogTime({
        description: timeLogData.description,
        timeSpent: timeLogData.timeSpent,
        date: timeLogData.date,
        taskId: task.id,
        userId: "user-1", // Current user
        user: {
          id: "user-1",
          firstName: "John",
          lastName: "Doe",
          avatar: "/api/placeholder/32/32",
        },
      });

      setTimeLogData({
        timeSpent: 0,
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
      setShowLogTime(false);
    }
  };

  const handleEditTime = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditData({
      timeSpent: entry.timeSpent,
      description: entry.description || "",
      date: entry.date,
    });
  };

  const handleUpdateTime = () => {
    if (editingEntry) {
      onUpdateTime(editingEntry.id, editData);
      setEditingEntry(null);
      setEditData({ timeSpent: 0, description: "", date: "" });
    }
  };

  const handleDeleteTime = (entry: TimeEntry) => {
    onDeleteTime(entry.id);
    setTimeEntryToDelete(null);
  };

  // Update timer display
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerStart) {
      interval = setInterval(() => {
        const elapsed = Math.floor((new Date().getTime() - timerStart.getTime()) / 1000);
        setTimerElapsed(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStart]);

  return (
    <div className="space-y-6">
      {/* Time Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Time Summary</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatTime(getTotalTimeSpent())}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Time Spent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatTime(task.originalEstimate || 0)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Original Estimate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatTime(getTimeRemaining())}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Time Remaining</div>
          </div>
        </div>

        {/* Progress Bar */}
        {task.originalEstimate && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span>{Math.round(getProgressPercentage())}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  getProgressPercentage() > 100 ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(100, getProgressPercentage())}%` }}
              />
            </div>
          </div>
        )}

        {/* Timer */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-xl font-mono text-gray-900 dark:text-white">
                {formatDuration(timerElapsed)}
              </div>
              <div className="flex space-x-2">
                {!isTimerRunning ? (
                  <Button onClick={startTimer}>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h1m4 0h1M12 5v14m7-7H5"
                      />
                    </svg>
                    Start Timer
                  </Button>
                ) : (
                  <Button onClick={stopTimer} variant="secondary">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Stop Timer
                  </Button>
                )}
                <Button onClick={resetTimer} variant="outline">
                  Reset
                </Button>
              </div>
            </div>
            <Button onClick={() => setShowLogTime(true)} variant="outline">
              Log Time
            </Button>
          </div>
        </div>
      </div>

      {/* Time Entries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Time Entries</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {task.timeEntries?.length || 0} entries
          </span>
        </div>

        {task.timeEntries && task.timeEntries.length > 0 ? (
          <div className="space-y-3">
            {task.timeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <UserAvatar user={entry.user} size="sm" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatTime(entry.timeSpent)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        on {new Date(entry.date).toLocaleDateString()}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditTime(entry)}
                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setTimeEntryToDelete(entry)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>No time entries</p>
            <p className="text-sm">Start tracking time to see entries here</p>
          </div>
        )}
      </div>

      {/* Log Time Modal */}
      {showLogTime && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Log Time</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time Spent (minutes) *
                </label>
                <input
                  type="number"
                  value={timeLogData.timeSpent}
                  onChange={(e) =>
                    setTimeLogData((prev) => ({
                      ...prev,
                      timeSpent: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={timeLogData.description}
                  onChange={(e) =>
                    setTimeLogData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="What did you work on?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={timeLogData.date}
                  onChange={(e) => setTimeLogData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="secondary" onClick={() => setShowLogTime(false)}>
                Cancel
              </Button>
              <Button onClick={handleLogTime} disabled={timeLogData.timeSpent === 0}>
                Log Time
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Time Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Time Entry
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time Spent (minutes) *
                </label>
                <input
                  type="number"
                  value={editData.timeSpent}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, timeSpent: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="What did you work on?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={editData.date}
                  onChange={(e) => setEditData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="secondary" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTime} disabled={editData.timeSpent === 0}>
                Update Time
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Time Confirmation */}
      {timeEntryToDelete && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setTimeEntryToDelete(null)}
          onConfirm={() => handleDeleteTime(timeEntryToDelete)}
          title="Delete Time Entry"
          message={`Are you sure you want to delete this time entry of ${formatTime(timeEntryToDelete.timeSpent)}?`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  );
}
