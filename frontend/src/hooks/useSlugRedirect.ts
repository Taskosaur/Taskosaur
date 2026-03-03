import { useCallback } from "react";
import { useRouter } from "next/router";
import { useWorkspace } from "@/contexts/workspace-context";
import { useProject } from "@/contexts/project-context";

const SLUG_CACHE_KEY = "taskosaur_slug_cache";
function getSlugCache(): Record<string, string> {
    try {
        const raw = localStorage.getItem(SLUG_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function setSlugCache(cache: Record<string, string>) {
    try {
        localStorage.setItem(SLUG_CACHE_KEY, JSON.stringify(cache));
    } catch {
   }
}

export function cacheSlugId(type: "workspace" | "project", slug: string, id: string) {
    if (!slug || !id) return;
    const cache = getSlugCache();
    cache[`${type}:${slug}`] = id;
    setSlugCache(cache);
}
function getCachedId(type: "workspace" | "project", slug: string): string | null {
    const cache = getSlugCache();
    return cache[`${type}:${slug}`] || null;
}

export function useSlugRedirect() {
    const router = useRouter();
    const { getWorkspaceById } = useWorkspace();
    const { getProjectById } = useProject();
    const checkAndRedirectWorkspaceSlug = useCallback(
        async (urlWorkspaceSlug: string, workspaceId?: string): Promise<boolean> => {
            const wsId = workspaceId || getCachedId("workspace", urlWorkspaceSlug);
            if (!wsId) return false;

            try {
                const freshWorkspace = await getWorkspaceById(wsId);
                if (freshWorkspace && freshWorkspace.slug !== urlWorkspaceSlug) {
                    cacheSlugId("workspace", freshWorkspace.slug, freshWorkspace.id);

                    const currentPath = router.asPath;
                    const newPath = currentPath.replace(
                        `/${urlWorkspaceSlug}`,
                        `/${freshWorkspace.slug}`
                    );
                    await router.replace(newPath);
                    return true;
                }
            } catch {
            }
            return false;
        },
        [router, getWorkspaceById]
    );

    const checkAndRedirectProjectSlug = useCallback(
        async (
            urlWorkspaceSlug: string,
            urlProjectSlug: string,
            projectId?: string
        ): Promise<boolean> => {
            const projId = projectId || getCachedId("project", urlProjectSlug);
            if (!projId) return false;

            try {
                const freshProject = await getProjectById(projId);
                if (!freshProject) return false;

                const freshWorkspace = freshProject.workspace;
                const newWorkspaceSlug = freshWorkspace?.slug || urlWorkspaceSlug;
                const newProjectSlug = freshProject.slug;

                if (
                    newWorkspaceSlug !== urlWorkspaceSlug ||
                    newProjectSlug !== urlProjectSlug
                ) {
                    cacheSlugId("project", newProjectSlug, freshProject.id);
                    if (freshWorkspace?.id) {
                        cacheSlugId("workspace", newWorkspaceSlug, freshWorkspace.id);
                    }

                    const currentPath = router.asPath;
                    let newPath = currentPath;

                    if (newWorkspaceSlug !== urlWorkspaceSlug) {
                        newPath = newPath.replace(
                            `/${urlWorkspaceSlug}/`,
                            `/${newWorkspaceSlug}/`
                        );
                    }

                    if (newProjectSlug !== urlProjectSlug) {
                        newPath = newPath.replace(
                            `/${urlProjectSlug}`,
                            `/${newProjectSlug}`
                        );
                    }

                    await router.replace(newPath);
                    return true; 
                }
            } catch {
            }
            return false;
        },
        [router, getProjectById]
    );
    const handleSlugNotFound = useCallback(
        async (
            error: any,
            urlWorkspaceSlug: string,
            urlProjectSlug?: string,
            cachedWorkspaceId?: string,
            cachedProjectId?: string
        ): Promise<boolean> => {
            const errorMessage =
                error?.response?.data?.message ||
                error?.message ||
                "";
            const status = error?.response?.status;

            const isNotFound =
                status === 404 ||
                status === 403 ||
                errorMessage.toLowerCase().includes("not found") ||
                errorMessage.toLowerCase().includes("not a member");

            if (!isNotFound) return false;

            if (urlProjectSlug) {
                const redirected = await checkAndRedirectProjectSlug(
                    urlWorkspaceSlug,
                    urlProjectSlug,
                    cachedProjectId || undefined
                );
                if (redirected) return true;
            }

            const redirected = await checkAndRedirectWorkspaceSlug(
                urlWorkspaceSlug,
                cachedWorkspaceId || undefined
            );
            if (redirected) return true;

            return false;
        },
        [checkAndRedirectWorkspaceSlug, checkAndRedirectProjectSlug]
    );

    return {
        checkAndRedirectWorkspaceSlug,
        checkAndRedirectProjectSlug,
        handleSlugNotFound,
    };
}
