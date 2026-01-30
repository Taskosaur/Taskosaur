import ProjectsContent from "@/components/projects/ProjectsContent";
import { TokenManager } from "@/lib/api";
import { SEO } from "@/components/common/SEO";
import { useTranslation } from "react-i18next";

export default function ProjectsPage() {
  const { t } = useTranslation("projects");
  const orgId = TokenManager.getCurrentOrgId();

  return (
    <>
      <SEO title={t("title")} />
      <ProjectsContent
        contextType="organization"
        contextId={orgId}
        title={t("title")}
        description={t("description")}
        emptyStateTitle={t("empty_state_title")}
        emptyStateDescription={t("empty_state_description")}
        enablePagination={true}
        generateProjectLink={(project) => `/${project.workspace.slug}/${project.slug}`}
      />
    </>
  );
}

