import Link from "next/link";
import WorkspaceAvatar from "@/components/ui/avatars/WorkspaceAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HiCog, HiPlus } from "react-icons/hi2";
import { useState } from "react";
import { NewProjectModal } from "@/components/projects/NewProjectModal";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  slug: string;
  organizationId: string;
}

interface WorkspaceHeaderProps {
  workspace: Workspace;
  workspaceSlug: string;
}

export function WorkspaceHeader({ workspace, workspaceSlug }: WorkspaceHeaderProps) {
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  return (
    <div className="dashboard-header">
      {/* Left Section: Avatar + Name + Badge + Description */}
      <div className="dashboard-user-section">
        <WorkspaceAvatar workspace={workspace} size="xl" />

        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="dashboard-greeting font-bold text-[var(--foreground)]">
              {workspace.name}
            </h1>
            <Badge
              variant="secondary"
              className="px-2 py-1 text-xs border-none bg-[var(--primary)]/10 text-[var(--primary)]"
            >
              Workspace
            </Badge>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md">
            {workspace.description ||
              `Collaborate on projects and manage tasks for ${workspace.name}.`}
          </p>
        </div>
      </div>

      {/* Right Section: Buttons */}
      <div className="dashboard-header-actions">
        <Link href={`/${workspaceSlug}/settings`}>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] flex items-center gap-2"
          >
            <HiCog className="dashboard-icon-sm" />
            Settings
          </Button>
        </Link>
        <Button
          className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium rounded-lg flex items-center gap-2"
          onClick={() => setIsNewProjectModalOpen(true)}
        >
          <HiPlus className="dashboard-icon-sm" />
          New Project
        </Button>

        <NewProjectModal
          isOpen={isNewProjectModalOpen}
          onClose={() => setIsNewProjectModalOpen(false)}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </div>
  );
}
