import WorkspacesPageContent from "@/components/workspace/WorkspacesPageContent";
import { TokenManager } from "@/lib/api";

export default function WorkspacesPage() {
  const orgId = TokenManager.getCurrentOrgId();

  return <WorkspacesPageContent organizationId={orgId} />;
}
