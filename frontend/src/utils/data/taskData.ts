import {
  CalendarDays,
  Clock,
  CheckCircle,
  Type,
  Star,
  Tag,
  Hash,
  ListChecks,
  FileText,
} from "lucide-react";

import {
  HiOutlineClipboard,
  HiOutlineLightBulb,
  HiOutlineBugAnt,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { HiOutlineViewList } from "react-icons/hi";

export const TaskPriorities = [
  { id: "LOW", name: "Low", value: "LOW", color: "#6b7280" },
  { id: "MEDIUM", name: "Medium", value: "MEDIUM", color: "#f59e0b" },
  { id: "HIGH", name: "High", value: "HIGH", color: "#ef4444" },
  { id: "HIGHEST", name: "Highest", value: "HIGHEST", color: "#dc2626" },
];

export const labelColors = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Green", value: "#10B981" },
  { name: "Yellow", value: "#F59E0B" },
  { name: "Red", value: "#EF4444" },
  { name: "Gray", value: "#6B7280" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Pink", value: "#EC4899" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Orange", value: "#F97316" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Lime", value: "#65A30D" },
];

export const PRIORITY_OPTIONS = [
  {
    value: "LOW",
    label: "Low",
    color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  {
    value: "HIGH",
    label: "High",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  },
  {
    value: "HIGHEST",
    label: "Highest",
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  },
];

export const TASK_TYPE_OPTIONS = [
  { value: "TASK", label: "Task" },
  { value: "BUG", label: "Bug" },
  { value: "EPIC", label: "Epic" },
  { value: "STORY", label: "Story" },
  { value: "SUBTASK", label: "Subtask" },
];

export const DEFAULT_SORT_FIELDS = [
  { value: "createdAt", label: "Created Date", icon: Clock, category: "date" },
  { value: "updatedAt", label: "Updated Date", icon: CalendarDays, category: "date" },
  { value: "dueDate", label: "Due Date", icon: CalendarDays, category: "date" },
  { value: "completedAt", label: "Completed Date", icon: CheckCircle, category: "date" },
  { value: "title", label: "Task Title", icon: Type, category: "text" },
  { value: "priority", label: "Priority", icon: Star, category: "text" },
  { value: "status", label: "Status", icon: Tag, category: "text" },
  { value: "taskNumber", label: "Task Number", icon: Hash, category: "number" },
  { value: "storyPoints", label: "Story Points", icon: ListChecks, category: "number" },
  { value: "commentsCount", label: "Comments", icon: FileText, category: "number" },
];

export const TaskTypeIcon = {
  TASK: { label: "Task", icon: HiOutlineClipboard, color: "blue-500" },
  STORY: { label: "Story", icon: HiOutlineLightBulb, color: "green-500" },
  BUG: { label: "Bug", icon: HiOutlineBugAnt, color: "red-500" },
  EPIC: { label: "Epic", icon: HiOutlineSparkles, color: "purple-500" },
  SUBTASK: { label: "Subtask", icon: HiOutlineViewList, color: "orange-500" },
} as const;

// Task Type Color mapping from Tailwind class to hex
export const TaskTypeColorMap: Record<string, string> = {
  "blue-500": "#3B82F6",
  "green-500": "#10B981",
  "red-500": "#EF4444",
  "purple-500": "#8B5CF6",
  "orange-500": "#F97316",
};

// Helper function to get hex color from task type
export const getTaskTypeHexColor = (taskType: keyof typeof TaskTypeIcon): string => {
  const color = TaskTypeIcon[taskType]?.color;
  return TaskTypeColorMap[color] || "#6B7280"; // Default gray
};
