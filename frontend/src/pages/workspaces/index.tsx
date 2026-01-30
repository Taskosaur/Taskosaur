import WorkspacesPageContent from "@/components/workspace/WorkspacesPageContent";
import { TokenManager } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function WorkspacesPage() {
  const { i18n } = useTranslation("workspaces");
  const orgId = TokenManager.getCurrentOrgId();

  return (
    <>
      <WorkspacesPageContent organizationId={orgId} />
    </>
  );
}


