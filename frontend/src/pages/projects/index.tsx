import ProjectsContent from "@/components/projects/ProjectsContent";
import { TokenManager } from "@/lib/api";

export default function ProjectsPage() {
  const orgId = TokenManager.getCurrentOrgId();
  return (
    <ProjectsContent
      contextType="organization"
      contextId={orgId}
      title="Your Projects"
      description="Manage and organize projects within this organization."
      emptyStateTitle="No projects found"
      emptyStateDescription="Create your first project to get started with organizing your tasks and collaborating with your team."
      enablePagination={true}
      generateProjectLink={(project) => `/${project.workspace.slug}/${project.slug}`}
    />
  );
}
