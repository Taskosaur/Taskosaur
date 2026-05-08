import { useState, useEffect, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useTask } from "@/contexts/task-context";
import TaskDetailClient from "@/components/tasks/TaskDetailClient";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/auth-context";
import TaskDetailsSkeleton from "@/components/skeletons/TaskDetailsSkeleton";
import ErrorState from "@/components/common/ErrorState";

function TaskDetailContent() {
  const { t } = useTranslation(["tasks", "common"]);
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { taskId } = router.query;

  const { getTaskBySlug } = useTask();
  const { isAuthenticated } = useAuth();

  const fetchData = async () => {
    try {
      const taskData = await getTaskBySlug(taskId as string, isAuthenticated());
      if (!taskData) throw new Error("Task not found");

      const enhancedTask = {
        ...taskData,
        comments: (taskData as any).comments || [],
        attachments: (taskData as any).attachments || [],
        subtasks: (taskData as any).subtasks || [],
        tags: (taskData as any).tags || [],
        reporter: (taskData as any).reporter || null,
        updatedAt:
          (taskData as any).updatedAt || (taskData as any).createdAt || new Date().toISOString(),
      };

      setTask(enhancedTask);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error?.message ? error.message : "Failed to load task data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId) {
      if (router.isReady) {
         setError("Invalid URL parameters");
         setIsLoading(false);
      }
      return;
    }

    setTask(null);
    setError(null);
    setIsLoading(true);

    fetchData();
  }, [taskId, router.isReady]);

  if (isLoading) {
    return <TaskDetailsSkeleton />;
  }

  if (error || !task) {
    return <ErrorState error={error} />;
  }

  return (
    <Suspense fallback={<div className="p-4"><div className="animate-pulse h-96 bg-[var(--muted)] rounded"></div></div>}>
      <TaskDetailClient task={task} taskId={task.slug as string} />
    </Suspense>
  );
}

export default function TaskDetailPage() {
  return (
    <Suspense fallback={null}>
      <TaskDetailContent />
    </Suspense>
  );
}
