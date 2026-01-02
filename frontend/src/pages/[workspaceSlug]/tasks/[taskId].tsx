import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { useTask } from "@/contexts/task-context";
import { useAuth } from "@/contexts/auth-context";
import TaskDetailClient from "@/components/tasks/TaskDetailClient";
import ErrorState from "@/components/common/ErrorState";
import { useLayout } from "@/contexts/layout-context";
import NotFound from "@/pages/404";
import { extractUuid } from "@/utils/slugUtils";

function TaskDetailContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug, taskId } = router.query;
  const cleanTaskId = useMemo(() => extractUuid(taskId as string), [taskId]);
  const { setShow404 } = useLayout();
  const { getTaskById } = useTask();
  const { isAuthenticated } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      if (!cleanTaskId) {
        if (router.isReady && isAuthenticated()) {
           setError("Task ID required");
           setLoading(false);
        }
        return;
      }
      
      if (!isAuthenticated()) {
         return; // Auth context will handle redirect usually, or layout
      }

      try {
        const taskData = await getTaskById(cleanTaskId as string, isAuthenticated());

        if (!taskData) {
          setError("Task not found");
          setLoading(false);
          return;
        }

        setTask(taskData);
      } catch (err) {
        setError(err?.message ? err.message : "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [cleanTaskId, router.isReady, isAuthenticated]);

  // Update URL with slug
  useEffect(() => {
    if (task && task.slug && cleanTaskId && taskId) {
      const expectedId = `${cleanTaskId}-${task.slug}`;
      if (taskId !== expectedId) {
        router.replace(
          {
            pathname: router.pathname,
            query: { ...router.query, taskId: expectedId },
          },
          undefined,
          { shallow: true }
        );
      }
    }
  }, [task, cleanTaskId, taskId, router]);

  if (loading) {
    return (
      <div className="p-6">
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
    <div className="">
      <TaskDetailClient
        task={task}
        workspaceSlug={workspaceSlug as string}
        projectSlug={projectSlug as string}
        taskId={cleanTaskId as string}
      />
    </div>
  );
}

export default function TaskDetailPage() {
  return <TaskDetailContent />;
}
