import React from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { HiClipboardDocumentList } from "react-icons/hi2";

interface EmptyStateProps {
  searchQuery?: string;
  priorityFilter?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ searchQuery = "", priorityFilter = "all" }) => {
  const noTasksMessage =
    searchQuery || priorityFilter !== "all" ? "No tasks found" : "No tasks yet";
  const descriptionMessage =
    searchQuery || priorityFilter !== "all"
      ? "Try adjusting your filters or search query."
      : "Create your first task to get started with project management.";

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardContent className="p-8 text-center">
        <HiClipboardDocumentList
          size={48}
          className="mx-auto text-[var(--muted-foreground)] mb-4"
        />
        <CardTitle className="text-lg font-medium mb-2 text-[var(--foreground)]">
          {noTasksMessage}
        </CardTitle>
        <CardDescription className="text-sm text-[var(--muted-foreground)] mb-6">
          {descriptionMessage}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
