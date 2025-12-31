import { WorkspaceAnalytics } from "@/components/workspace/WorkspaceAnalytics";
import { useRouter } from "next/router";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLayout } from "@/contexts/layout-context";
import NotFound from "@/pages/404";
import ActionButton from "@/components/common/ActionButton";
import { SEO } from "@/components/common/SEO";

export default function WorkspacePage() {
  const router = useRouter();
  const { workspaceSlug } = router.query;
  const { error } = useWorkspace();
  const { setShow404 } = useLayout();

  const displayTitle = workspaceSlug 
    ? (workspaceSlug as string).charAt(0).toUpperCase() + (workspaceSlug as string).slice(1)
    : "Workspace";

  if (error) {
    // Check if it's a 404/not found error
    const is404Error = error.toLowerCase().includes('not found') ||
                       error.toLowerCase().includes('404') ||
                       error.toLowerCase().includes('workspace not found');

    if (is404Error) {
      setShow404(true);
      return (
        <>
          <SEO title="Workspace Not Found" />
          <NotFound />
        </>
      );
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
      <SEO title={displayTitle} />
      <WorkspaceAnalytics workspaceSlug={workspaceSlug as string} />
    </div>
  );
}
