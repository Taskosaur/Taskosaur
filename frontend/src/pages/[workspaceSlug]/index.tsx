import { WorkspaceAnalytics } from "@/components/workspace/WorkspaceAnalytics";
import { useRouter } from "next/router";
import { useWorkspace } from "@/contexts/workspace-context";

export default function WorkspacePage() {
  const router = useRouter();
  const { workspaceSlug } = router.query;
  const { error } = useWorkspace();

  if (error) {
    router.replace("/workspaces");
    return null;
  }

  if (!workspaceSlug) {
    router.replace("/workspaces");
    return null;
  }

  return (
    <div className="dashboard-container">
      <WorkspaceAnalytics workspaceSlug={workspaceSlug as string} />
    </div>
  );
}
