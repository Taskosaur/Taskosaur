import { useRouter } from "next/router";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useTask } from "@/contexts/task-context";
import { useAuth } from "@/contexts/auth-context";
import TaskDetailClient from "@/components/tasks/TaskDetailClient";
import ErrorState from "@/components/common/ErrorState";
import { useLayout } from "@/contexts/layout-context";
import NotFound from "@/pages/404";
import { SEO } from "@/components/common/SEO";

function TaskDetailContent() {
  const { t } = useTranslation(["tasks", "common"]);
  const router = useRouter();
  const { workspaceSlug, projectSlug, taskId } = router.query;
  const { setShow404 } = useLayout();
  const { getTaskBySlug } = useTask();
  const { isAuthenticated } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      if (!router.isReady) return;

      if (!taskId) {
        setError("Task slug required");
        setLoading(false);
        return;
      }

      try {
        const taskData = await getTaskBySlug(taskId as string, isAuthenticated());

        if (!taskData) {
          if (!isAuthenticated()) {
            router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
            return;
          }
          setError("Task not found");
          setLoading(false);
          return;
        }

        setTask(taskData);
        setLoading(false);
      } catch (err) {
        if (!isAuthenticated()) {
          router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
          return;
        }
        setError(err?.message ? err.message : "Failed to load task");
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId, router.isReady, isAuthenticated]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[var(--muted)] rounded w-1/3"></div>
          <div className="h-96 bg-[var(--muted)] rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's a 404/not found error
    const is404Error = error.toLowerCase().includes('not found') ||
                       error.toLowerCase().includes('404') ||
                       error.toLowerCase().includes('task not found');

    if (is404Error) {
      setShow404(true);
      return <NotFound />;
    }

    return <ErrorState error={error} />;
  }

  if (!task) {
    setShow404(true);
    return <NotFound />;
  }

  return (
    <>
      <SEO
        title={task?.title || t("tasks:detail.placeholderTaskTitle")}
        description={task?.description || t("tasks:description")}
      />
      <div className="">
        <Suspense fallback={<div className="p-4"><div className="animate-pulse h-96 bg-[var(--muted)] rounded"></div></div>}>
          <TaskDetailClient
            task={task}
            workspaceSlug={workspaceSlug as string}
            projectSlug={projectSlug as string}
            taskId={task.slug as string}
          />
        </Suspense>
      </div>
    </>
  );
}

export default function TaskDetailPage() {
  return (
    <Suspense fallback={null}>
      <TaskDetailContent />
    </Suspense>
  );
}
