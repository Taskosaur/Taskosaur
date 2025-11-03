import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useTask } from "@/contexts/task-context";
import { useAuth } from "@/contexts/auth-context";
import TaskDetailClient from "@/components/tasks/TaskDetailClient";
import ErrorState from "@/components/common/ErrorState";

function TaskDetailContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug, taskId } = router.query;
  const { getTaskById } = useTask();
  const { isAuthenticated } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId || !isAuthenticated()) {
        setError("Task ID required");
        setLoading(false);
        return;
      }

      try {
        const taskData = await getTaskById(taskId as string, isAuthenticated());

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
  }, [taskId, isAuthenticated]);

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
    return <ErrorState error={error} />;
  }

  if (!task) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Task not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <TaskDetailClient
        task={task}
        workspaceSlug={workspaceSlug as string}
        projectSlug={projectSlug as string}
        taskId={taskId as string}
      />
    </div>
  );
}

export default function TaskDetailPage() {
  return <TaskDetailContent />;
}
