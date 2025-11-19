import { Sprint } from "@/types";
import { useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { HiCalendarDays, HiEllipsisVertical } from "react-icons/hi2";
import { HiCheck, HiPencil, HiTrash } from "react-icons/hi";
import { useRouter } from "next/router";

export const SprintCard = ({
  sprint,
  onEdit,
  onDelete,
  onStatusChange,
  hasAccess = false,
}: {
  sprint: Sprint;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (action: "start" | "complete") => void;
  hasAccess?: boolean;
}) => {
  const router = useRouter();
  const { projectSlug, workspaceSlug } = router.query;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Only allow slugs consisting of alphanumerics, hyphens, and underscores, 1-64 chars
  const isValidSlug = (slug: unknown): slug is string => {
    return typeof slug === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(slug);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysBetween = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const duration = useMemo(() => {
    if (!sprint.startDate || !sprint.endDate) return "No dates set";

    const start = formatDate(sprint.startDate);
    const end = formatDate(sprint.endDate);
    const days = getDaysBetween(sprint.startDate, sprint.endDate);

    return `${start} - ${end} (${days} days)`;
  }, [sprint.startDate, sprint.endDate]);

  // Prevent dropdown menu clicks from triggering card click
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".dropdown-menu-trigger") || target.closest(".dropdown-menu-content")) {
      return;
    }
    if (!isValidSlug(workspaceSlug) || !isValidSlug(projectSlug)) {
      // Optionally display an error or just abort navigation
      return;
    }
    router.push(`/${workspaceSlug}/${projectSlug}/sprints/${sprint.id}`);
  };

  return (
    <Card
      className="bg-[var(--card)] border-none shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-[var(--foreground)] mb-2 group-hover:text-[var(--primary)] transition-colors">
              {sprint.name}
            </CardTitle>
            {sprint.goal && (
              <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mb-3">
                {sprint.goal}
              </p>
            )}
          </div>

          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            {hasAccess && (
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity dropdown-menu-trigger"
                  onClick={(e) => e.stopPropagation()}
                >
                  <HiEllipsisVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
            )}
            <DropdownMenuContent
              align="end"
              className="bg-[var(--card)] border-none shadow-lg dropdown-menu-content"
            >
              {sprint.status === "ACTIVE" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    onStatusChange("complete");
                  }}
                  className="text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  <HiCheck className="w-4 h-4 mr-2" />
                  Complete Sprint
                </DropdownMenuItem>
              )}
              {hasAccess && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    onEdit();
                  }}
                  className="text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  <HiPencil className="w-4 h-4 mr-2" />
                  Edit Sprint
                </DropdownMenuItem>
              )}
              {hasAccess && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    onDelete();
                  }}
                  className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                >
                  <HiTrash className="w-4 h-4 mr-2" />
                  Delete Sprint
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Timeline */}
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <HiCalendarDays className="w-4 h-4" />
            <span>{duration}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
