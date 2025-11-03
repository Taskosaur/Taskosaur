import React from "react";
import { useRouter } from "next/router";
import { HiFolder } from "react-icons/hi";
import { InfoPanel } from "@/components/common/InfoPanel";
import { StatusBadge } from "@/components/badges/StatusBadge";
import ActionButton from "@/components/common/ActionButton";
import { Project } from "@/types";

interface ProjectsWithPaginationProps {
  projects: Project[];
  viewAllLink?: string;
}

const isValidProject = (project: Project): boolean => {
  if (!project.workspace?.slug) {
    return false;
  }

  if (!project.slug && !project.name) {
    return false;
  }

  return true;
};

const getWorkspaceSlug = (project: Project): string => {
  return project.workspace?.slug || "";
};

const generateProjectUrl = (project: Project): string => {
  const workspaceSlug = getWorkspaceSlug(project);
  const projectSlug = project.slug;

  return `/${workspaceSlug}/${projectSlug}`;
};

const generateWorkspaceProjectsUrl = (project: Project): string => {
  const workspaceSlug = getWorkspaceSlug(project);
  return `/${workspaceSlug}/projects`;
};

const generateNewProjectUrl = (project: Project): string => {
  const workspaceSlug = getWorkspaceSlug(project);
  return `/${workspaceSlug}/projects/new`;
};

const ProjectsWithPagination: React.FC<ProjectsWithPaginationProps> = ({
  projects,
  viewAllLink,
}) => {
  const router = useRouter();

  const validProjects = projects.filter(isValidProject);

  if (validProjects.length !== projects.length) {
  }

  const displayedProjects = validProjects.slice(0, 3);

  const firstValidProject = validProjects[0];
  const workspaceProjectsUrl = firstValidProject
    ? generateWorkspaceProjectsUrl(firstValidProject)
    : "/workspaces";
  const newProjectUrl = firstValidProject
    ? generateNewProjectUrl(firstValidProject)
    : "/workspaces";

  const handleProjectClick = (project: Project) => {
    const projectUrl = generateProjectUrl(project);
    router.push(projectUrl);
  };

  const handleNewProjectClick = () => {
    router.push(newProjectUrl);
  };

  return (
    <InfoPanel
      title="My Projects"
      subtitle="Manage and track your active projects"
      viewAllHref={viewAllLink || workspaceProjectsUrl}
      viewAllText="View all"
      className="dashboard-card"
    >
      <div className="py-4">
        {validProjects.length === 0 ? (
          <div className="text-center py-8 flex flex-col items-center justify-center">
            <div className="w-12 h-12 mb-3 rounded-xl bg-[var(--muted)] flex items-center justify-center">
              <HiFolder className="w-6 h-6 text-[var(--muted-foreground)]" />
            </div>
            <p className="text-sm font-medium text-[var(--accent-foreground)] mb-1">
              No projects found
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mb-3">
              {projects.length > 0
                ? "Projects found but missing workspace data."
                : "Create your first project to get started."}
            </p>
            <ActionButton
              primary
              showPlusIcon
              onClick={handleNewProjectClick}
              className="text-xs mx-auto"
            >
              New Project
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 rounded-lg transition-colors bg-[var(--card)] hover:bg-[var(--hover-bg)] cursor-pointer"
                onClick={() => handleProjectClick(project)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white uppercase"
                    style={{ backgroundColor: project.color }}
                  >
                    {project.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--accent-foreground)] capitalize">
                      {project.name}
                    </div>
                    <div className="text-[12px] text-[var(--muted-foreground)] capitalize">
                      {project.workspace?.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <StatusBadge status={project.status} type="project" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </InfoPanel>
  );
};

export default ProjectsWithPagination;
