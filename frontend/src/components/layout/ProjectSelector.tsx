import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { getCurrentProjectId, setCurrentProjectId } from "@/utils/hierarchyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HiChevronDown, HiCheck } from "react-icons/hi2";
import { Project } from "@/types";

interface ProjectSelectorProps {
  currentWorkspaceSlug: string | null;
  currentProjectSlug: string | null;
}

export default function ProjectSelector({
  currentWorkspaceSlug,
  currentProjectSlug,
}: ProjectSelectorProps) {
  const router = useRouter();
  const { getProjectsByWorkspace } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false); // loading starts true

  /* ---------------- fetch workspace ---------------- */
  useEffect(() => {
    if (!currentWorkspaceSlug) return;

    getWorkspaceBySlug(currentWorkspaceSlug)
      .then(setCurrentWorkspace)
      .catch(() => setCurrentWorkspace(null));
  }, [currentWorkspaceSlug]);

  /* ---------------- fetch projects ---------------- */
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const data = await getProjectsByWorkspace(currentWorkspace.id);
        setProjects(data ?? []);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [currentWorkspace?.id]);

  /* ---------------- resolve current project ---------------- */
  useEffect(() => {
    if (projects.length === 0) {
      setCurrentProject(null);
      return;
    }

    // 1. Try URL slug
    let project =
      currentProjectSlug &&
      projects.find((p) => (p.slug || slugify(p.name)) === currentProjectSlug);

    // 2. Fallback to localStorage id
    if (!project) {
      const storedId = getCurrentProjectId(); // util that reads localStorage
      project = projects.find((p) => p.id === storedId);
    }
    setCurrentProject(project ?? null);
  }, [projects, currentProjectSlug]);

  /* ---------------- handlers ---------------- */
  const handleProjectSelect = (project: Project) => {
    if (!currentWorkspaceSlug) return;

    setCurrentProjectId(project.id);
    window.dispatchEvent(new CustomEvent("projectChanged"));

    router.replace(`/${currentWorkspaceSlug}/${project.slug || slugify(project.name)}`);
  };

  /* ---------------- helpers ---------------- */
  const getProjectKey = (p: Project) => p.key || p.name.slice(0, 3).toUpperCase();
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

  /* ---------------- render ---------------- */
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="layout-project-selector-trigger">
          <div
            className="layout-project-selector-icon"
            style={{ backgroundColor: currentProject?.color || "var(--sidebar-primary)" }}
          >
            {currentProject ? getProjectKey(currentProject) : "P"}
          </div>

          <div className="layout-project-selector-content">
            {isLoading ? (
              <div className="layout-project-selector-loading" />
            ) : (
              <div className="layout-project-selector-title">
                {currentProject ? currentProject.name : "Select Project"}
              </div>
            )}
          </div>

          <HiChevronDown className="layout-project-selector-chevron" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="layout-project-selector-dropdown"
        align="start"
        sideOffset={8}
      >
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => handleProjectSelect(project)}
            className={`layout-project-selector-item ${
              currentProject?.id === project.id ? "layout-project-selector-item-selected" : ""
            }`}
          >
            <Avatar className="layout-project-selector-item-avatar">
              <AvatarFallback
                className="layout-project-selector-item-avatar-fallback"
                style={{ backgroundColor: project.color || "var(--primary)" }}
              >
                {getProjectKey(project)}
              </AvatarFallback>
            </Avatar>

            <div className="layout-project-selector-item-content">
              <div className="layout-project-selector-item-name">{project.name}</div>
              <div className="layout-project-selector-item-description">
                {project.description || "No description"}
              </div>
            </div>

            {currentProject?.id === project.id && (
              <HiCheck className="layout-project-selector-item-check" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
