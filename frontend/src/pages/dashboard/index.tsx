import { OrganizationAnalytics } from "@/components/organizations/OrganizationAnalytics";
import { TokenManager } from "@/lib/api";
import { SEO } from "@/components/common/SEO";

export default function DashboarPage() {
  const orgId = TokenManager.getCurrentOrgId();
  return (
    <>
      <SEO title="Dashboard" />
      <div className="dashboard-container">
        <OrganizationAnalytics organizationId={orgId} />
      </div>
    </>
  );
}
