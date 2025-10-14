"use client";

import { useState, useEffect } from "react";
import  { useTask } from "@/contexts/task-context";
import TaskDetailClient from "@/components/tasks/TaskDetailClient";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HiExclamationTriangle, HiArrowLeft } from "react-icons/hi2";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/auth-context";
import TaskDetailsSkeleton from "@/components/skeletons/TaskDetailsSkeleton";
function TaskDetailContent() {
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { taskId } = router.query;
  const { getTaskById } = useTask();
  const { isAuthenticated } = useAuth();

  const fetchData = async () => {
    
    try {
        const taskData = await getTaskById(taskId as string, isAuthenticated());
      if (!taskData) throw new Error("Task not found");

      const enhancedTask = {
        ...taskData,
        comments: (taskData as any).comments || [],
        attachments: (taskData as any).attachments || [],
        subtasks: (taskData as any).subtasks || [],
        tags: (taskData as any).tags || [],
        reporter: (taskData as any).reporter || null,
        updatedAt:
          (taskData as any).updatedAt ||
          (taskData as any).createdAt ||
          new Date().toISOString(),
      };

      setTask(enhancedTask);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load task data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId) {
      setError("Invalid URL parameters");
      setIsLoading(false);
      return;
    }

    setTask(null);
    setError(null);
    setIsLoading(true);

    fetchData();
  }, [taskId]);

  if (isLoading) {
    return <TaskDetailsSkeleton />;
  }

  if (error || !task) {
    return (
      <div className="task-detail-error">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HiExclamationTriangle /> Task Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              {error || "Task could not be found."}
            </CardDescription>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.back()}
              >
                <HiArrowLeft size={14} />
                Go back
              </Button>
              <Button variant="secondary" size="sm" onClick={fetchData}>
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <TaskDetailClient task={task} taskId={taskId as string} />;
}

export default function TaskDetailPage() {
  return <TaskDetailContent />;
}
