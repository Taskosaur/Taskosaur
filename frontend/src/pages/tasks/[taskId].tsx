import { useState, useEffect, useMemo } from "react";
import { useTask } from "@/contexts/task-context";
import TaskDetailClient from "@/components/tasks/TaskDetailClient";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/auth-context";
import TaskDetailsSkeleton from "@/components/skeletons/TaskDetailsSkeleton";
import ErrorState from "@/components/common/ErrorState";
import { extractUuid } from "@/utils/slugUtils";
function TaskDetailContent() {
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { taskId } = router.query;
  const cleanTaskId = useMemo(() => extractUuid(taskId as string), [taskId]);
  
  const { getTaskById } = useTask();
  const { isAuthenticated } = useAuth();

  const fetchData = async () => {
    try {
      const taskData = await getTaskById(cleanTaskId as string, isAuthenticated());
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
    if (!cleanTaskId) {
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
  }, [cleanTaskId, router.isReady]);

  // Update URL with slug if missing
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

  if (isLoading) {
    return <TaskDetailsSkeleton />;
  }

  if (error || !task) {
    return <ErrorState error={error} />;
  }

  return <TaskDetailClient task={task} taskId={cleanTaskId as string} />;
}

export default function TaskDetailPage() {
  return <TaskDetailContent />;
}
