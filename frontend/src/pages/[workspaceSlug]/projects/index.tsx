import { useRouter } from "next/router";
import ProjectsContent from "@/components/projects/ProjectsContent";

export default function WorkspaceProjectsPage() {
  const router = useRouter();
  const { workspaceSlug } = router.query;

  return (
    <ProjectsContent
      contextType="workspace"
      contextId={workspaceSlug as string}
      workspaceSlug={workspaceSlug as string}
      title="Projects"
      description="Manage and organize projects within this workspace."
      emptyStateTitle="No projects found"
      emptyStateDescription="Create your first project to get started with organizing your tasks and collaborating with your team."
      enablePagination={false}
      generateProjectLink={(project, workspaceSlug) => `/${workspaceSlug}/${project.slug}`}
    />
  );
}
