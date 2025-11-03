import MembersManager from "@/components/shared/MembersManager";

interface ProjectMembersProps {
  projectId: string;
  organizationId: string;
  workspaceId: string;
  className?: string;
}

export default function ProjectMembers({
  projectId,
  organizationId,
  workspaceId,
  className = "",
}: ProjectMembersProps) {
  return (
    <div className="projects-members-wrapper">
      <MembersManager
        type="project"
        entityId={projectId}
        organizationId={organizationId}
        workspaceId={workspaceId}
        className={className}
      />
    </div>
  );
}
