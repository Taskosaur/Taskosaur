import { ProjectAnalytics } from "@/components/projects/ProjectAnalytics";
import { useRouter } from "next/router";
import { SEO } from "@/components/common/SEO";

export default function ProjectPage() {
  const router = useRouter();
  const { projectSlug } = router.query;

  const displayTitle = projectSlug 
    ? (projectSlug as string).charAt(0).toUpperCase() + (projectSlug as string).slice(1)
    : "Project";

  return (
    <div className="dashboard-container">
      <SEO title={displayTitle} />
      <ProjectAnalytics projectSlug={projectSlug as string} />
    </div>
  );
}
