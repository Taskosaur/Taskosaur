import Link from "next/link";
import { useState } from "react";
import { HiFolder } from "react-icons/hi2";
import { InfoPanel } from "../common/InfoPanel";
import ActionButton from "@/components/common/ActionButton";
import NewWorkspaceDialog from "../workspace/NewWorkspaceDialogProps";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organizationId: string;
}

interface WorkspacesCardProps {
  title?: string;
  subtitle?: string;
  workspaces: Workspace[];
  maxDisplay?: number;
  emptyStateConfig?: {
    title: string;
    description: string;
    buttonText: string;
    buttonHref: string;
  };
}

export function WorkspacesCard({
  title = "Workspaces",
  subtitle,
  workspaces,
  maxDisplay = 3,
  emptyStateConfig = {
    title: "Create workspace",
    description: "Start organizing your projects",
    buttonText: "New Workspace",
    buttonHref: "/workspaces/new",
  },
}: WorkspacesCardProps) {
  const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = useState(false);
  const renderWorkspaceContent = () => {
    if (workspaces && workspaces.length > 0) {
      return (
        <div className="space-y-2">
          {workspaces.slice(0, maxDisplay).map((workspace) => (
            <Link
              key={workspace.id}
              href={`/${workspace.slug}`}
              className="block"
              style={{ textDecoration: "none" }}
            >
              <div className="flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-[var(--hover-bg)]">
                <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] uppercase rounded-lg flex items-center justify-center cursor-pointer w-8 h-8 min-w-8 min-h-8">
                    {workspace.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--accent-foreground)] capitalize truncate">
                    {workspace.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">
                    {workspace.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    return (
      <div className="text-center py-6 flex flex-col items-center justify-center">
        <div className="w-10 h-10 mb-2 rounded-xl bg-[var(--muted)] flex items-center justify-center">
          <HiFolder className="w-5 h-5 text-[var(--muted-foreground)]" />
        </div>
        <p className="text-sm font-medium text-[var(--accent-foreground)] mb-1">
          {emptyStateConfig.title}
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mb-3">
          {emptyStateConfig.description}
        </p>
        <ActionButton onClick={() => setShowNewWorkspaceDialog(true)} primary showPlusIcon>
          {emptyStateConfig.buttonText}
        </ActionButton>
      </div>
    );
  };

  return (
    <>
      <InfoPanel title={title} subtitle={subtitle} viewAllHref="/workspaces" viewAllText="View all">
        {renderWorkspaceContent()}
      </InfoPanel>

      <NewWorkspaceDialog
        open={showNewWorkspaceDialog}
        onOpenChange={setShowNewWorkspaceDialog}
        refetchWorkspaces={async () => window.location.reload()}
      />
    </>
  );
}
