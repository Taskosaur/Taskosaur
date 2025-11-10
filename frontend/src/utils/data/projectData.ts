export const PROJECT_CATEGORIES = [
  {
    id: "operational",
    label: "Operational",
    color: "#3B82F6", // Blue
    description: "Day-to-day operations and maintenance",
  },
  {
    id: "technical",
    label: "Technical",
    color: "#8B5CF6", // Purple
    description: "Development and technical projects",
  },
  {
    id: "strategic",
    label: "Strategic",
    color: "#10B981", // Green
    description: "Long-term planning and strategy",
  },
  {
    id: "hiring",
    label: "Hiring",
    color: "#F59E0B", // Yellow
    description: "Recruitment and team building",
  },
  {
    id: "financial",
    label: "Financial",
    color: "#EF4444", // Red
    description: "Budget and financial planning",
  },
  {
    id: "neutral",
    label: "Neutral",
    color: "#6B7280", // Gray
    description: "General or uncategorized projects",
  },
  {
    id: "innovation",
    label: "Innovation",
    color: "#6366F1", // Indigo
    description: "Creativity and innovation initiatives",
  },
  {
    id: "community",
    label: "Community",
    color: "#EC4899", // Pink
    description: "Community and engagement initiatives",
  },
  {
    id: "sustainability",
    label: "Sustainability",
    color: "#14B8A6", // Teal
    description: "Sustainability and environment projects",
  },
  {
    id: "marketing",
    label: "Marketing",
    color: "#F97316", // Orange
    description: "Marketing and outreach campaigns",
  },
  {
    id: "research",
    label: "Research",
    color: "#06B6D4", // Cyan
    description: "Research and analysis projects",
  },
  {
    id: "growth",
    label: "Growth",
    color: "#65A30D", // Lime
    description: "Growth and expansion initiatives",
  },
];

export const roles = [
  {
    id: "0",
    name: "OWNER",
    description: "Can manage all",
    variant: "default" as const,
  },
  {
    id: "1",
    name: "MANAGER",
    description: "Can manage project and members",
    variant: "default" as const,
  },
  {
    id: "2",
    name: "MEMBER",
    description: "Can access and work on projects",
    variant: "default" as const,
  },
  {
    id: "3",
    name: "VIEWER",
    description: "Can only view project content",
    variant: "secondary" as const,
  },
];

export const ACTION_TYPES = [
  { value: "setPriority", label: "Set Priority" },
  { value: "assignTo", label: "Assign To" },
  { value: "addLabels", label: "Add Labels" },
  { value: "markAsSpam", label: "Mark as Spam" },
  { value: "autoReply", label: "Auto Reply" },
];

export const EMAIL_FIELDS = [
  { value: "subject", label: "Subject" },
  { value: "from", label: "From" },
  { value: "to", label: "To" },
  { value: "cc", label: "CC" },
  { value: "body", label: "Body" },
];

export const EMAIL_OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "matches", label: "Matches" },
  { value: "startsWith", label: "Starts With" },
  { value: "endsWith", label: "Ends With" },
];
