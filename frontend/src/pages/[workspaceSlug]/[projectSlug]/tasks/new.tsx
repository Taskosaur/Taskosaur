import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HiExclamationTriangle } from "react-icons/hi2";
import CreateTask from "@/components/common/CreateTask";
import { useWorkspace } from "@/contexts/workspace-context";
import { useProject } from "@/contexts/project-context";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import { useSlugRedirect, cacheSlugId } from "@/hooks/useSlugRedirect";

function NewTaskPageContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;

  const { getWorkspaceBySlug } = useWorkspace();
  const { getProjectBySlug } = useProject();

  const { isAuthenticated } = useAuth();
  const { handleSlugNotFound } = useSlugRedirect();

  const [workspace, setWorkspace] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const isInitializedRef = useRef(false);

  // Initialize data
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated() || !workspaceSlug || !projectSlug || isInitializedRef.current) return;

      const wsSlug =
        typeof workspaceSlug === "string"
          ? workspaceSlug
          : Array.isArray(workspaceSlug)
            ? workspaceSlug[0]
            : "";

      const projSlug =
        typeof projectSlug === "string"
          ? projectSlug
          : Array.isArray(projectSlug)
            ? projectSlug[0]
            : "";

      try {
        const ws = await getWorkspaceBySlug(wsSlug);
        setWorkspace(ws);
        if (ws?.id) {
          cacheSlugId("workspace", wsSlug, ws.id);
        }

        const proj = await getProjectBySlug(projSlug, isAuthenticated());
        setProject(proj);
        if (proj?.id) {
          cacheSlugId("project", projSlug, proj.id);
        }

        isInitializedRef.current = true;
      } catch (error) {
        console.error("Error initializing data:", error);

        await handleSlugNotFound(
          error,
          wsSlug,
          projSlug,
          workspace?.id,
          project?.id
        );
      }
    };
    fetchData();
  }, [isAuthenticated, workspaceSlug, projectSlug]);

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-7xl mx-auto p-6">
          <Alert variant="destructive">
            <HiExclamationTriangle className="h-4 w-4" />
            <AlertTitle>Something Went Wrong</AlertTitle>
            <AlertDescription>
              Please log in to create a task.
              <div className="mt-4">
                <Link
                  href="/auth/login"
                  className="text-[var(--primary)] hover:text-[var(--primary)]/80 underline"
                >
                  Go to Login
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <>
      <CreateTask
        workspaceSlug={
          typeof workspaceSlug === "string"
            ? workspaceSlug
            : Array.isArray(workspaceSlug)
              ? workspaceSlug[0]
              : ""
        }
        projectSlug={
          typeof projectSlug === "string"
            ? projectSlug
            : Array.isArray(projectSlug)
              ? projectSlug[0]
              : ""
        }
        workspace={workspace}
        projects={project ? [project] : []}
      />
    </>
  );
}

export default function NewTaskPage() {
  return <NewTaskPageContent />;
}
