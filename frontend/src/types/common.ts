/**
 * Common types used across different domains
 */

export interface Stat {
  name: string;
  value: string;
}

export interface Activity {
  id: string;
  user: string; // Assuming user is identified by a string ID or name
  action: string;
  target: string;
  time: string;
  workspace?: string; // Assuming workspace is identified by a string ID or name
}

export interface Deadline {
  id: string;
  title: string;
  slug?: string;
  type: "project" | "task";
  workspace?: string; // Assuming workspace is identified by a string ID or name
  workspaceSlug?: string;
  projectSlug?: string;
  dueDate: string;
  daysLeft: number;
  progress: number;
}
