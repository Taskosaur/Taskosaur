// constants/defaultWorkflow.ts
export const DEFAULT_WORKFLOW = {
  name: "Default Workflow",
  description: "Auto-generated default workflow for new organizations",
} as const;

export const DEFAULT_TASK_STATUSES = [
  {
    name: "To Do",
    color: "#6366f1", // indigo-500
    category: "TODO" as const,
    position: 1,
    isDefault: true,
  },
  {
    name: "In Progress", 
    color: "#f59e0b",
    category: "IN_PROGRESS" as const,
    position: 2,
    isDefault: false,
  },
  {
    name: "In Review",
    color: "#8b5cf6", 
    category: "IN_PROGRESS" as const,
    position: 3,
    isDefault: false,
  },
  {
    name: "Done",
    color: "#10b981", 
    category: "DONE" as const,
    position: 4,
    isDefault: false,
  },
] as const;

export const DEFAULT_STATUS_TRANSITIONS = [
  { from: "To Do", to: "In Progress" },
  { from: "In Progress", to: "In Review" },
  { from: "In Progress", to: "Done" },
  { from: "In Review", to: "To Do" }, 
  { from: "In Review", to: "Done" },
] as const;

export const DEFAULT_SPRINT = {
  name: "Sprint 1",
  goal: "Initial sprint to establish development workflow and deliver core features",
  status: "PLANNING" as const,
  isDefault: true,
} as const;
