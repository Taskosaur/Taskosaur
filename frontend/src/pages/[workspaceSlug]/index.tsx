import { WorkspaceAnalytics } from "@/components/workspace/WorkspaceAnalytics";
import { useRouter } from "next/router";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLayout } from "@/contexts/layout-context";
import NotFound from "@/pages/404";

export default function WorkspacePage() {
  const router = useRouter();
  const { workspaceSlug } = router.query;
  const { error } = useWorkspace();
  const { setShow404 } = useLayout();

  if (error) {
    // Check if it's a 404/not found error
    const is404Error = error.toLowerCase().includes('not found') ||
                       error.toLowerCase().includes('404') ||
                       error.toLowerCase().includes('workspace not found');

    if (is404Error) {
      setShow404(true);
      return <NotFound />;
    }
    // For other errors, redirect to workspaces page
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
