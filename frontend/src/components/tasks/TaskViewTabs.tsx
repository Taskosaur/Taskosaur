import ViewTabs from "@/components/ui/tabs/ViewTabs";
import { taskViewTypes } from "@/components/ui/icons/TaskViewIcons";

interface TaskViewTabsProps {
  currentView: string;
  baseUrl: string;
  variant?: "cards" | "bordered";
}

export function TaskViewTabs({ currentView, baseUrl, variant = "cards" }: TaskViewTabsProps) {
  const tabs = taskViewTypes.map((viewType) => ({
    name: viewType.name,
    key: viewType.key,
    icon: viewType.icon,
    href: viewType.key === "list" ? baseUrl : `${baseUrl}/${viewType.key}`,
  }));

  return <ViewTabs tabs={tabs} currentView={currentView} variant={variant} />;
}
