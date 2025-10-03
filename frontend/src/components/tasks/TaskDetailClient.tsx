import { useState, useEffect } from "react";
import TaskComments from "./TaskComments";
import Subtasks from "./Subtasks";
import DropdownAction from "@/components/common/DropdownAction";
import { UpdateTaskRequest } from "@/types/task-dto";
import TaskAttachments from "./TaskAttachment";
import TaskLabels from "./TaskLabels";
import { useTask } from "@/contexts/task-context";
import { useProjectContext } from "@/contexts/project-context";
import { useAuth } from "@/contexts/auth-context";
import { TokenManager } from "@/lib/api";
import ActionButton from "@/components/common/ActionButton";
import { DynamicBadge } from "@/components/common/DynamicBadge";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { HiDocumentText, HiCog, HiPencil, HiTrash } from "react-icons/hi2";
import { HiAdjustments } from "react-icons/hi";
import { Input } from "@/components/ui/input";
import TaskDescription from "@/components/tasks/views/TaskDescription";
import { Label } from "@/components/ui/label";
import { Maximize2 } from "lucide-react";
import Tooltip from "../common/ToolTip";
import ConfirmationModal from "../modals/ConfirmationModal";
import { Badge } from "../ui";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import TaskActivities from "./TaskActivities";
import { TaskPriorities } from "@/utils/data/taskData";
import { formatDateForApi } from "@/utils/handleDateChange";
import MemberSelect from "../common/MemberSelect";

interface TaskDetailClientProps {
  task: any;
  taskId: string;
  workspaceSlug?: string;
  projectSlug?: string;
  open?: string;
  onTaskRefetch?: () => void;
  onClose?: () => void;
}

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon size={16} className="text-[var(--primary)]" />
    <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
  </div>
);

export default function TaskDetailClient({
  task,
  workspaceSlug,
  projectSlug,
  taskId,
  open,
  onTaskRefetch,
  onClose,
}: TaskDetailClientProps) {
  const {
    updateTask,
    deleteTask,
    getTaskAttachments,
    uploadAttachment,
    downloadAttachment,
    deleteAttachment,
    createLabel,
    getProjectLabels,
    assignLabelToTask,
    removeLabelFromTask,
    assignTaskAssignees,
  } = useTask();

  const { getProjectMembers, getTaskStatusByProject } = useProjectContext();
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const router = useRouter();

  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "info" as "danger" | "warning" | "info",
  });

  const showConfirmModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: "danger" | "warning" | "info" = "info"
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      type,
    });
  };

  const [editTaskData, setEditTaskData] = useState({
    title: task.title,
    description: task.description,
    priority:
      typeof task.priority === "object" ? task.priority?.name : task.priority,
    dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
  });

  const [assignees, setAssignees] = useState<any[]>(task.assignees || (task.assignee ? [task.assignee] : []));
  const [reporters, setReporters] = useState<any[]>(task.reporters || (task.reporter ? [task.reporter] : []));

  const [labels, setLabels] = useState(task.labels || task.tags || []);
  const [availableLabels, setAvailableLabels] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const currentOrganization = TokenManager.getCurrentOrgId();
  const { getUserAccess } = useAuth();
  const authContext = useAuth();
  const workspaceContext = useWorkspaceContext();
  const projectContext = useProjectContext();

  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [hasAccessLoaded, setHasAccessLoaded] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  // Exception: Assignee or reporter has access to all actions except Assignment section
  const isAssigneeOrReporter =
    currentUser?.id === assignees[0]?.id ||
    currentUser?.id === reporters[0]?.id;

  const handleStatusChange = async (item: any) => {
    if (!item) return;

    try {
      await updateTask(taskId, {
        statusId: item.id,
      });
      setCurrentStatus(item);
      // Update the task object's status
      task.status = item;
      toast.success("Task status updated successfully.");
    } catch (error) {
      toast.error("Failed to update task status. Please try again.");
    }
  };

  useEffect(() => {
    const projectId = task.projectId || task.project?.id;
    if (!projectId) return;

    const fetchProjectMembers = async () => {
      setLoadingMembers(true);
      try {
        const token = TokenManager.getAccessToken();
        if (token && projectId) {
          const members = await getProjectMembers(projectId);
          if (Array.isArray(members)) {
            const validMembers = members
              .filter((member) => member?.user)
              .map((member) => ({
                id: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                email: member.user.email,
                avatar: (member.user as any).avatar || null,
                role: member.role,
                username: `${member.user.firstName} ${member.user.lastName}`,
                status: (member.user as any).status || "active",
              }));
            setProjectMembers(validMembers);
          } else {
            setProjectMembers([]);
          }
        }
      } catch (error) {
        setProjectMembers([]);
        toast.error("Failed to fetch project members");
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchProjectMembers();
  }, [task.projectId, task.project?.id]);

  const handleDueDateChange = async (newDueDate: string) => {
  try {
    const updateData: UpdateTaskRequest = {
      dueDate: formatDateForApi(newDueDate) || undefined,
    };

    await updateTask(taskId, updateData);
    handleTaskFieldChange("dueDate", newDueDate);

    
    task.dueDate = formatDateForApi(newDueDate);

    toast.success("Task due date updated successfully.");
  } catch (error) {
    toast.error("Failed to update task due date.");
  }
};

  const findProjectBySlug = (projects: any[], slug: string) => {
    return projects.find((project) => project.slug === slug);
  };

  useEffect(() => {
    const loadWorkspaceAndProjectData = async () => {
      try {
        if (!authContext.isAuthenticated()) {
          router.push("/auth/login");
          return;
        }

        if (typeof workspaceSlug !== "string") {
          return;
        }

        const workspace = await workspaceContext.getWorkspaceBySlug(
          workspaceSlug
        );
        if (!workspace) {
          return;
        }
        setWorkspaceData(workspace);
        if (typeof projectSlug === "string") {
          const projects = await projectContext.getProjectsByWorkspace(
            workspace.id
          );
          const project = findProjectBySlug(projects || [], projectSlug);
          if (project) {
            setProjectData(project);
          }
        } else {
          setProjectData(null);
        }
      } catch (err) {
        console.error("Error loading workspace/project data:", err);
      }
    };

    loadWorkspaceAndProjectData();
  }, [workspaceSlug, projectSlug]);

  useEffect(() => {
    const loadWorkspaceAndProjectData = async () => {
      try {
        if (!authContext.isAuthenticated()) {
          router.push("/auth/login");
          return;
        }

        if (typeof workspaceSlug !== "string") {
          return;
        }

        const workspace = await workspaceContext.getWorkspaceBySlug(
          workspaceSlug
        );
        if (!workspace) {
          return;
        }
        setWorkspaceData(workspace);

        if (typeof projectSlug === "string") {
          const projects = await projectContext.getProjectsByWorkspace(
            workspace.id
          );
          const project = findProjectBySlug(projects || [], projectSlug);
          if (project) {
            setProjectData(project);
          }
        } else {
          setProjectData(null);
        }
      } catch (err) {
        console.error("Error loading workspace/project data:", err);
      }
    };

    loadWorkspaceAndProjectData();
  }, [workspaceSlug, projectSlug]);

  useEffect(() => {
    const loadUserAccess = async () => {
      let folderName: string;
      let folderId: string;

      if (projectData?.id && workspaceData?.id) {
        folderName = "project";
        folderId = projectData.id;
      } else if (workspaceData?.id) {
        folderName = "workspace";
        folderId = workspaceData.id;
      } else if (currentOrganization) {
        folderName = "organization";
        folderId = currentOrganization;
      } else {
        return;
      }

      try {
        const accessData = await getUserAccess({
          name: folderName,
          id: folderId,
        });
        
        // Main logic: access from API, but override for assignee/reporter
        setHasAccess(accessData?.canChange || isAssigneeOrReporter || false);
        setHasAccessLoaded(true);
      } catch (error) {
        console.error("Error fetching user access:", error);
        setHasAccess(isAssigneeOrReporter || false);
        setHasAccessLoaded(true);
      }
    };

    // Only load access if we haven't loaded it yet and have the required data
    if (!hasAccessLoaded && (workspaceData?.id || currentOrganization)) {
      loadUserAccess();
    }
  }, [workspaceData, projectData, currentOrganization, hasAccessLoaded]);

  useEffect(() => {
    setHasAccessLoaded(false);
    setHasAccess(false);
  }, [workspaceData?.id, projectData?.id]);

  useEffect(() => {
    const projectId = task.projectId || task.project?.id;
    if (!projectId) return;

    const fetchProjectLabels = async () => {
      try {
        const projectLabels = await getProjectLabels(projectId);
        const labelsData = projectLabels || [];
        setAvailableLabels(labelsData);

        if (task.labels && task.labels.length > 0) {
          setLabels(task.labels);
        } else if (task.tags && task.tags.length > 0) {
          setLabels(task.tags);
        }
      } catch (error) {
        setAvailableLabels([]);
        toast.error("Failed to fetch project labels");
      }
    };

    fetchProjectLabels();
  }, [task.projectId, task.project?.id, task.labels, task.tags]);

  useEffect(() => {
    if (!taskId) return;

    const fetchAttachments = async () => {
      setLoadingAttachments(true);
      try {
        const taskAttachments = await getTaskAttachments(taskId);
        const attachmentsData = taskAttachments || [];
        setAttachments(attachmentsData);
      } catch (error) {
        setAttachments([]);
        toast.error("Failed to fetch task attachments");
      } finally {
        setLoadingAttachments(false);
      }
    };

    fetchAttachments();
  }, [taskId]);

  useEffect(() => {
    const projectId = task.projectId || task.project?.id;
    if (!projectId) return;

    const fetchTaskStatuses = async () => {
      setLoadingStatuses(true);
      try {
        const allStatuses = await getTaskStatusByProject(projectId);
        if (Array.isArray(allStatuses)) {
          setStatuses(allStatuses);
        }
      } catch (error) {
        toast.error("Failed to fetch task statuses");
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchTaskStatuses();
  }, [task.projectId, task.project?.id]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const maxFileSize = 10 * 1024 * 1024;
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
      ];

      const validFiles = Array.from(files).filter((file) => {
        if (file.size > maxFileSize) {
          toast.error(
            `File "${file.name}" is too large. Maximum size is 10MB.`
          );
          return false;
        }
        if (!allowedTypes.includes(file.type)) {
          toast.error(`File "${file.name}" has an unsupported format.`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) {
        setIsUploading(false);
        event.target.value = "";
        return;
      }

      const uploadPromises = validFiles.map(async (file) => {
        try {
          const uploadedAttachment = await uploadAttachment(taskId, file);
          return uploadedAttachment;
        } catch (error) {
          toast.error(`Failed to upload "${file.name}". Please try again.`);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean);

      if (successfulUploads.length > 0) {
        const updatedAttachments = await getTaskAttachments(taskId);
        setAttachments(updatedAttachments || []);
        toast.success(
          `${successfulUploads.length} file(s) uploaded successfully.`
        );
      }
    } catch (error) {
      toast.error("Failed to upload one or more files. Please try again.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDownloadAttachment = async (
    attachmentId: string,
    fileName: string
  ) => {
    try {
      const blob = await downloadAttachment(attachmentId);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("File downloaded successfully.");
    } catch (error) {
      toast.error("Failed to download attachment. Please try again.");
    }
  };

  const handleAddLabel = async (name: string, color: string) => {
    try {
      const projectId = task.projectId || task.project?.id;
      if (!projectId) {
        toast.error("Project ID not found. Cannot create label.");
        return;
      }

      const newLabel = await createLabel({
        name,
        color,
        projectId,
      });

      onTaskRefetch;
      setAvailableLabels([...availableLabels, newLabel]);

      await assignLabelToTask({
        taskId: taskId,
        labelId: newLabel.id,
        userId: currentUser?.id || "",
      });

      setLabels([...labels, newLabel]);
      toast.success("Label created and assigned to task successfully.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add label. Please try again."
      );
    }
  };

  const handleRemoveLabel = async (labelId: string) => {
    try {
      await removeLabelFromTask(taskId, labelId);
      setLabels(
        labels.filter((label: any) => {
          return label.id !== labelId && label.labelId !== labelId;
        })
      );

      onTaskRefetch;
      toast.success("Label removed from task successfully.");
    } catch (error) {
      toast.error("Failed to remove label. Please try again.");
    }
  };

  const handleAssignExistingLabel = async (label: any) => {
    try {
      await assignLabelToTask({
        taskId: taskId,
        labelId: label.id,
        userId: currentUser?.id || "",
      });

      setLabels([...labels, label]);

      onTaskRefetch;

      toast.success("Label assigned to task successfully.");
    } catch (error) {
      toast.error("Failed to assign label. Please try again.");
    }
  };

  const handleDeleteAttachment = (attachmentId: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!currentUser?.id) {
        toast.error("You must be logged in to delete attachments.");
        resolve();
        return;
      }

      setConfirmModal({
        isOpen: true,
        title: "Delete Attachment",
        message:
          "Are you sure you want to delete this attachment? This action cannot be undone.",
        type: "danger",
        onConfirm: async () => {
          try {
            await deleteAttachment(attachmentId, currentUser.id);
            const updatedAttachments = await getTaskAttachments(taskId);
            setAttachments(updatedAttachments || []);
            toast.success("Attachment deleted successfully.");
          } catch (error) {
            toast.error("Failed to delete attachment. Please try again.");
          }
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          resolve();
        },
      });
    });
  };

  const handleEditTask = () => {
    setIsEditingTask(true);
  };

  const handleSaveTaskEdit = async (
    e?: React.FormEvent,
    updatedDescription?: string
  ) => {
    e?.preventDefault();

    const descriptionToSave = updatedDescription || editTaskData.description;

    if (!editTaskData?.title?.trim()) {
      toast.error("Task title cannot be empty.");
      return;
    }

    try {
      const updatedTask = await updateTask(taskId, {
        title: editTaskData?.title?.trim(),
        description: descriptionToSave?.trim(),
        priority: editTaskData.priority || "MEDIUM",
        startDate: task.startDate || new Date().toISOString(),
        dueDate: editTaskData.dueDate
          ? new Date(editTaskData.dueDate + "T00:00:00.000Z").toISOString()
          : undefined,
        remainingEstimate: task.remainingEstimate || 0,
        assigneeIds: assignees.map((a) => a.id),
        reporterIds: reporters.map((r) => r.id),
        statusId: task.status?.id || task.statusId,
        projectId: task.projectId || task.project?.id,
      });

      Object.assign(task, updatedTask);
      setIsEditingTask(false);
      toast.success("Task updated successfully.");
    } catch (error) {
      toast.error("Failed to update the task. Please try again.");
    }
  };

  const handleCheckboxSave = (newValue: string) => {
    handleTaskFieldChange("description", newValue);
    handleSaveTaskEdit(undefined, newValue);
  };

  const handleCancelTaskEdit = () => {
    const hasChanges =
      editTaskData.title !== task.title ||
      editTaskData.description !== task.description ||
      editTaskData.dueDate !== (task.dueDate ? task.dueDate.split("T")[0] : "");

    if (hasChanges) {
      setConfirmModal({
        isOpen: true,
        title: "Discard Changes",
        message: "Are you sure you want to discard your changes?",
        type: "info",
        onConfirm: () => {
          setEditTaskData({
            title: task.title,
            description: task.description,
            priority:
              typeof task.priority === "object"
                ? task.priority?.name
                : task.priority,
            dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
          });
          setIsEditingTask(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setIsEditingTask(false);
    }
  };

  const handleTaskFieldChange = (field: string, value: string) => {
    setEditTaskData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDeleteTask = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Task",
      message:
        "Are you sure you want to delete this task? This action cannot be undone.",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteTask(taskId);
          toast.success("Task deleted successfully.");

          onTaskRefetch && onTaskRefetch();
          if (open === "modal") {
            onClose && onClose();
          } else {
            router.back();
          }
        } catch (error) {
          toast.error("Failed to delete the task. Please try again.");
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };



  useEffect(() => {
    if (projectMembers.length > 0) {
      let updatedAssignee = assignees;
      let updatedReporter = reporters;
      if (task.assigneeId) {
        const foundAssignee = projectMembers.find(
          (member) => member.id === task.assigneeId
        );
        if (foundAssignee) updatedAssignee = [foundAssignee];
      }
      if (task.reporterId) {
        const foundReporter = projectMembers.find(
          (member) => member.id === task.reporterId
        );
        if (foundReporter) updatedReporter = [foundReporter];
      }
      setAssignees(updatedAssignee);
      setReporters(updatedReporter);
    }
  }, [projectMembers, task.assigneeId, task.reporterId]);

  const detailUrl =
    workspaceSlug && projectSlug
      ? `/${workspaceSlug}/${projectSlug}/tasks/${task.id}`
      : workspaceSlug
      ? `/${workspaceSlug}/tasks/${task.id}`
      : `/tasks/${task.id}`;

  function getPriorityBgColor(priority: any): string {
    if (typeof priority === "object") {
      if (typeof priority.name === "string") {
        const found = TaskPriorities.find(
          (p) =>
            p.name.toLowerCase() === priority.name.toLowerCase() ||
            p.id === priority.name
        );
        return found?.color || "#6B7280";
      }
      return priority.name?.color || "#6B7280";
    }

    if (typeof priority === "string") {
      const found = TaskPriorities.find(
        (p) =>
          p.name.toLowerCase() === priority.toLowerCase() || p.id === priority
      );
      return found?.color || "#6B7280";
    }
    return "#6B7280";
  }

  return (
    <div className="dashboard-container pt-0">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-md font-bold text-[var(--foreground)]">
              {task.title}
            </h1>
            <div className="flex items-center gap-2">
              <DynamicBadge
                label={
                  typeof task.status === "object"
                    ? typeof task.status.name === "string"
                      ? task.status.name
                      : task.status.name?.name || "Unknown"
                    : task.status || "Unknown"
                }
                bgColor={
                  task.status?.color || task.status?.name?.color || "#6B7280"
                }
                size="sm"
              />
              <DynamicBadge
                label={`${
                  typeof task.priority === "object"
                    ? typeof task.priority.name === "string"
                      ? task.priority.name
                      : task.priority.name?.name || "Unknown"
                    : task.priority || "Unknown"
                } Priority`}
                bgColor={getPriorityBgColor(task.priority)}
                size="sm"
              />

              {open === "modal" && (
                <Tooltip content="Expand to full screen" position="right">
                  <div onClick={() => router.push(detailUrl)}>
                    <Maximize2 className="w-7 h-7 pl-2 cursor-pointer" />
                  </div>
                </Tooltip>
              )}
            </div>
          </div>
          {task.createdBy === currentUser?.id && (
            <div className=" flex gap-2">
              <Tooltip content="Edit task" position="left" color="primary">
                <ActionButton
                  onClick={handleEditTask}
                  variant="outline"
                  secondary
                  className="cursor-pointer justify-center px-3"
                >
                  <HiPencil className="w-4 h-4" />
                </ActionButton>
              </Tooltip>
              <Tooltip content="Delete task" position="left" color="primary">
                <ActionButton
                  onClick={handleDeleteTask}
                  variant="outline"
                  className="justify-center cursor-pointer border-none bg-[var(--destructive)]/5 hover:bg-[var(--destructive)]/10 text-[var(--destructive)]"
                >
                  <HiTrash className="w-4 h-4" />
                </ActionButton>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm p-6">
              <SectionHeader icon={HiDocumentText} title="Description" />
              {isEditingTask ? (
                <div className="space-y-4">
                  <Input
                    value={editTaskData.title}
                    onChange={(e) =>
                      handleTaskFieldChange("title", e.target.value)
                    }
                    placeholder="Task title"
                    className="text-xs bg-[var(--background)] border-[var(--border)] "
                  />
                  <TaskDescription
                    value={editTaskData.description}
                    onChange={(value) =>
                      handleTaskFieldChange("description", value)
                    }
                    editMode={true}
                  />
                  <div className="flex items-center gap-4 mt-4">
                    <ActionButton
                      onClick={handleSaveTaskEdit}
                      variant="outline"
                      secondary
                      className="justify-center bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
                    >
                      Save Changes
                    </ActionButton>
                    <ActionButton
                      onClick={handleCancelTaskEdit}
                      variant="outline"
                      className="justify-center"
                    >
                      Cancel
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <TaskDescription
                  value={editTaskData.description}
                  editMode={false}
                  onChange={(value) =>
                    handleTaskFieldChange("description", value)
                  }
                  onSaveRequest={handleCheckboxSave}
                />
              )}
            </div>

            {!task.parentTaskId && (
              <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm p-6">
                <Subtasks
                  taskId={taskId}
                  projectId={task.projectId || task.project?.id}
                  onSubtaskAdded={() => {}}
                  onSubtaskUpdated={() => {}}
                  onSubtaskDeleted={() => {}}
                  showConfirmModal={showConfirmModal}
                />
              </div>
            )}

            <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm p-6">
              <TaskAttachments
                attachments={attachments}
                isUploading={isUploading}
                loadingAttachments={loadingAttachments}
                onFileUpload={handleFileUpload}
                onDownloadAttachment={handleDownloadAttachment}
                onDeleteAttachment={handleDeleteAttachment}
                hasAccess={hasAccess}
              />
            </div>

            <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm p-6">
              <TaskComments
                taskId={taskId}
                onCommentAdded={() => {}}
                onCommentUpdated={() => {}}
                onCommentDeleted={() => {}}
                hasAccess={hasAccess}
              />
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* Task Settings Section */}
            <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm p-6">
              <SectionHeader icon={HiAdjustments} title="Task Settings" />
              <div className="space-y-4">
                <div>
                  <Label className="text-sm mb-2 block">Priority</Label>
                  {hasAccess ? (
                    <DropdownAction
                      currentItem={{
                        id: editTaskData.priority || "MEDIUM",
                        name:
                          editTaskData.priority?.charAt(0).toUpperCase() +
                            editTaskData.priority?.slice(1).toLowerCase() ||
                          "Medium",
                        color: task.priority?.color || "#F59E0B",
                      }}
                      availableItems={TaskPriorities}
                      loading={false}
                      onItemSelect={async (item) => {
                        try {
                          const updateData: UpdateTaskRequest = {
                            priority: item.id as
                              | "LOW"
                              | "MEDIUM"
                              | "HIGH"
                              | "HIGHEST",
                          };
                          await updateTask(taskId, updateData);
                          handleTaskFieldChange("priority", item.id);
                          // Update the task object's priority
                          task.priority = {
                            name: item,
                            id: item.id,
                          };
                          toast.success("Task priority updated successfully.");
                        } catch (error) {
                          toast.error("Failed to update task priority.");
                        }
                      }}
                      placeholder="Select priority..."
                      showUnassign={false}
                      hideAvatar={true}
                      hideSubtext={true}
                      itemType="user"
                    />
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs bg-[var(--muted)] border-[var(--border)] ml-auto flex-shrink-0"
                    >
                      {editTaskData?.priority}
                    </Badge>
                  )}
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Status</Label>
                  {hasAccess ? (
                    <DropdownAction
                      currentItem={currentStatus}
                      availableItems={statuses}
                      loading={loadingStatuses}
                      onItemSelect={handleStatusChange}
                      placeholder="Select status..."
                      showUnassign={false}
                      hideAvatar={true}
                      hideSubtext={true}
                      itemType="status"
                      onDropdownOpen={async () => {
                        if (statuses.length === 0) {
                          const projectId = task.projectId || task.project?.id;
                          if (projectId) {
                            try {
                              const allStatuses = await getTaskStatusByProject(
                                projectId
                              );
                              setStatuses(allStatuses || []);
                            } catch (error) {
                              toast.error("Failed to fetch task statuses");
                            }
                          }
                        }
                      }}
                    />
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs bg-[var(--muted)] border-[var(--border)] ml-auto flex-shrink-0"
                    >
                      {currentStatus?.name}
                    </Badge>
                  )}
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Due Date</Label>
                  {hasAccess ? (
                    <div className="relative">
                      <Input
                        type="date"
                        value={editTaskData.dueDate}
                        min={today}
                        onChange={(e) => handleDueDateChange(e.target.value)}
                        className="text-xs bg-[var(--background)] border-[var(--border)] w-full cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        placeholder="Select due date..."
                      />
                      {editTaskData.dueDate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDueDateChange("");
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs z-10"
                          title="Clear due date"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs bg-[var(--muted)] border-[var(--border)] ml-auto flex-shrink-0"
                    >
                      {editTaskData.dueDate
                        ? new Date(editTaskData.dueDate).toLocaleDateString()
                        : "No due date"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Assignment Section */}
            <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm p-6">
              <SectionHeader icon={HiCog} title="Assignment" />
              <div className="space-y-4">
                <div>
                  <MemberSelect
                    label="Assignees"
                    selectedMembers={assignees}
                    onChange={async (newAssignees) => {
                      setAssignees(newAssignees);
                      try {
                        await assignTaskAssignees(taskId, newAssignees.map((a) => a.id));
                        toast.success("Assignees updated successfully.");
                      } catch {
                        toast.error("Failed to update assignees.");
                      }
                    }}
                    members={projectMembers}
                    disabled={!hasAccess}
                    placeholder={projectMembers.length === 0 ? "No members" : "Select assignees..."}
                  />
                </div>
                <div>
                  <MemberSelect
                    label="Reporters"
                    selectedMembers={reporters}
                    onChange={async (newReporters) => {
                      setReporters(newReporters);
                      try {
                        await updateTask(taskId, { reporterIds: newReporters.map((r) => r.id) });
                        toast.success("Reporters updated successfully.");
                      } catch {
                        toast.error("Failed to update reporters.");
                      }
                    }}
                    members={projectMembers}
                    disabled={!hasAccess}
                    placeholder={projectMembers.length === 0 ? "No members" : "Select reporters..."}
                  />
                </div>
              </div>
            </div>

            {/* Labels Section */}
            <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm p-6">
              <TaskLabels
                labels={labels}
                availableLabels={availableLabels}
                onAddLabel={handleAddLabel}
                onAssignExistingLabel={handleAssignExistingLabel}
                onRemoveLabel={handleRemoveLabel}
                hasAccess={hasAccess}
              />
            </div>

            <div className="bg-[var(--card)] rounded-[var(--card-radius)] shadow-sm">
              <TaskActivities taskId={taskId} />
            </div>
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={
          confirmModal.type === "danger"
            ? "Delete"
            : confirmModal.type === "warning"
            ? "Continue"
            : "Confirm"
        }
        cancelText="Cancel"
      />
    </div>
  );
}
