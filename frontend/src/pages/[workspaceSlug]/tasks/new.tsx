import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HiExclamationTriangle } from "react-icons/hi2";
import CreateTask from "@/components/common/CreateTask";
import { useWorkspace } from "@/contexts/workspace-context";
import { useProject } from "@/contexts/project-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";

function NewTaskPageContent() {
  const router = useRouter();

  const { workspaceSlug } = router.query;

  const { getWorkspaceBySlug } = useWorkspace();
  const { getProjectsByWorkspace } = useProject();
  const { isAuthenticated } = useAuth();

  const [workspace, setWorkspace] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);

  const isInitializedRef = useRef(false);

  useEffect(() => {
    const fetchWorkspaceData = async () => {
      if (!isAuthenticated() || !workspaceSlug || isInitializedRef.current) return;
      try {
        const ws = await getWorkspaceBySlug(
          typeof workspaceSlug === "string"
            ? workspaceSlug
            : Array.isArray(workspaceSlug)
              ? workspaceSlug[0]
              : ""
        );
        setWorkspace(ws);
        const projs = ws?.id ? await getProjectsByWorkspace(ws.id) : [];
        setProjects(projs);

        isInitializedRef.current = true;
      } catch (error) {
        console.error("Error initializing workspace data:", error);
      }
    };
    fetchWorkspaceData();
  }, [isAuthenticated, workspaceSlug]);

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-7xl mx-auto p-6">
          <Alert variant="destructive">
            <HiExclamationTriangle className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
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
        workspace={workspace}
        projects={projects}
      />
    </>
  );
}

export default function NewTaskPage() {
  return <NewTaskPageContent />;
}
