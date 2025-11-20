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
import { CgArrowsExpandRight } from "react-icons/cg";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { HiPencil, HiTrash } from "react-icons/hi2";
import { PriorityBadge } from "@/components/badges/PriorityBadge";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { Input } from "@/components/ui/input";
import TaskDescription from "@/components/tasks/views/TaskDescription";
import { Label } from "@/components/ui/label";
import Tooltip from "../common/ToolTip";
import ConfirmationModal from "../modals/ConfirmationModal";
import { Badge } from "../ui";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import TaskActivities from "./TaskActivities";
import { TaskPriorities } from "@/utils/data/taskData";
import { formatDateForApi } from "@/utils/handleDateChange";
import MemberSelect from "../common/MemberSelect";
import Divider from "../common/Divider";
import { ToggleSwitch } from "../common/ToggleButton";
import { TASK_TYPE_OPTIONS, TaskTypeIcon, getTaskTypeHexColor } from "@/utils/data/taskData";
import { DynamicBadge } from "@/components/common/DynamicBadge";
import TaskDetailSkeleton from "../skeletons/TaskDetailSkeleton";
import validator from "validator";

// Helper function to validate internal paths and prevent open redirect vulnerabilities
function isValidInternalPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  // Ensure the path starts with / and doesn't contain protocol or domain
  if (!path.startsWith('/')) return false;
  if (path.includes('://') || path.startsWith('//')) return false;
  return true;
}

// Helper function to sanitize slug inputs before URL construction
function sanitizeSlug(slug: string | string[] | undefined): string {
  if (!slug || typeof slug !== 'string') return '';
  // Allow alphanumeric, dash, underscore, and dot
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) return '';
  return slug;
}

interface TaskDetailClientProps {
  task: any;
  taskId: string;
  workspaceSlug?: string;
  projectSlug?: string;
  open?: string;
  onTaskRefetch?: () => void;
  onClose?: () => void;
}

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
  const { getCurrentUser, isAuthenticated } = useAuth();
  const currentUser = getCurrentUser();
  const isAuth = isAuthenticated();
  const router = useRouter();

  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState({
    title: false,
    description: false,
    priority: false,
    status: false,
    dueDate: false,
    startDate: false,
    taskType: false,
  });
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [loadingLabels, setLoadingLabels] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [minLoadTimeElapsed, setMinLoadTimeElapsed] = useState(false);

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
    priority: typeof task.priority === "object" ? task.priority?.name : task.priority,
    dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
    startDate: task.startDate ? task.startDate.split("T")[0] : "",
    taskType: task.type || task.taskType || "",
  });

  // Track if there are unsaved changes
  const hasUnsavedChanges =
    editTaskData.title !== task.title ||
    editTaskData.description !== task.description ||
    editTaskData.dueDate !== (task.dueDate ? task.dueDate.split("T")[0] : "");

  const handleStartDateChange = (newStartDate: string) => {
    // Validate that start date is not after due date
    if (newStartDate && editTaskData.dueDate) {
      const startDate = new Date(newStartDate + "T00:00:00");
      const dueDate = new Date(editTaskData.dueDate + "T00:00:00");
      if (startDate > dueDate) {
        toast.error("Start date cannot be after due date.");
        return;
      }
    }

    // Only update local state
    handleTaskFieldChange("startDate", newStartDate);
  };

  const saveStartDate = async (newStartDate: string) => {
    try {
      const updateData: UpdateTaskRequest = {
        startDate: formatDateForApi(newStartDate) || undefined,
      };
      await updateTask(taskId, updateData);
      toast.success("Task start date updated successfully.");
    } catch (error) {
      toast.error("Failed to update task start date.");
      // Revert on error
      handleTaskFieldChange("startDate", task.startDate ? task.startDate.split("T")[0] : "");
    }
  };

  const [assignees, setAssignees] = useState<any[]>(
    task.assignees || (task.assignee ? [task.assignee] : [])
  );
  const [reporters, setReporters] = useState<any[]>(
    task.reporters || (task.reporter ? [task.reporter] : [])
  );

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
  const [autoOpenDropdown, setAutoOpenDropdown] = useState({
    priority: false,
    status: false,
    taskType: false,
  });
  const [allowEmailReplies, setAllowEmailReplies] = useState(task.allowEmailReplies || false);

  const today = new Date().toISOString().split("T")[0];
  // Exception: Assignee or reporter has access to all actions except Assignment section
  const isAssigneeOrReporter =
    assignees?.some((a) => a?.id === currentUser?.id) ||
    reporters?.some((r) => r?.id === currentUser?.id);

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
    const allLoaded =
      !loadingMembers &&
      !loadingAttachments &&
      !loadingLabels &&
      !loadingStatuses &&
      hasAccessLoaded;

    if (allLoaded && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [
    loadingMembers,
    loadingAttachments,
    loadingLabels,
    loadingStatuses,
    hasAccessLoaded,
    initialLoadComplete,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadTimeElapsed(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const projectId = task.projectId || task.project?.id;
    if (!projectId || !isAuth) return;

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

  const handleDueDateChange = (newDueDate: string) => {
    // Validate that due date is not before start date
    if (newDueDate && editTaskData.startDate) {
      const dueDate = new Date(newDueDate + "T00:00:00");
      const startDate = new Date(editTaskData.startDate + "T00:00:00");
      if (dueDate < startDate) {
        toast.error("Due date cannot be before start date.");
        return;
      }
    }

    // Only update local state
    handleTaskFieldChange("dueDate", newDueDate);
  };

  const saveDueDate = async (newDueDate: string) => {
    try {
      const updateData: UpdateTaskRequest = {
        dueDate: formatDateForApi(newDueDate) || undefined,
      };

      await updateTask(taskId, updateData);
      toast.success("Task due date updated successfully.");
    } catch (error) {
      toast.error("Failed to update task due date.");
      // Revert on error
      handleTaskFieldChange("dueDate", task.dueDate ? task.dueDate.split("T")[0] : "");
    }
  };

  const findProjectBySlug = (projects: any[], slug: string) => {
    return projects.find((project) => project.slug === slug);
  };

  useEffect(() => {
    const loadWorkspaceAndProjectData = async () => {
      try {
        if (!authContext.isAuthenticated()) {
          return;
        }

        if (typeof workspaceSlug !== "string") {
          return;
        }

        const workspace = await workspaceContext.getWorkspaceBySlug(workspaceSlug);
        if (!workspace) {
          return;
        }
        setWorkspaceData(workspace);
        if (typeof projectSlug === "string") {
          const projects = await projectContext.getProjectsByWorkspace(workspace.id);
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
          return;
        }

        if (typeof workspaceSlug !== "string") {
          return;
        }

        const workspace = await workspaceContext.getWorkspaceBySlug(workspaceSlug);
        if (!workspace) {
          return;
        }
        setWorkspaceData(workspace);

        if (typeof projectSlug === "string") {
          const projects = await projectContext.getProjectsByWorkspace(workspace.id);
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
    if (!isAuth) return;
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
        setHasAccess(
          accessData?.canChange || isAssigneeOrReporter || task.createdBy === currentUser.id
        );
        setHasAccessLoaded(true);
      } catch (error) {
        console.error("Error fetching user access:", error);
        setHasAccess(isAssigneeOrReporter);
        setHasAccessLoaded(true);
      }
    };

    // Only load access if we haven't loaded it yet and have the required data
    if (!hasAccessLoaded && (workspaceData?.id || currentOrganization)) {
      loadUserAccess();
    }
  }, [workspaceData, projectData, currentOrganization, hasAccessLoaded]);

  useEffect(() => {
    if (!isAuth) return;
    setHasAccessLoaded(false);
    setHasAccess(false);
  }, [workspaceData?.id, projectData?.id]);

  useEffect(() => {
    const projectId = task.projectId || task.project?.id;
    if (!projectId || !isAuth) return;

    const fetchProjectLabels = async () => {
      setLoadingLabels(true);
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
      } finally {
        setLoadingLabels(false);
      }
    };

    fetchProjectLabels();
  }, [task.projectId, task.project?.id, task.labels, task.tags]);

  useEffect(() => {
    if (!taskId || !hasAccessLoaded) return;

    const fetchAttachments = async () => {
      setLoadingAttachments(true);
      try {
        const taskAttachments = await getTaskAttachments(taskId, isAuth);
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
  }, [taskId, hasAccessLoaded]);

  useEffect(() => {
    const projectId = task.projectId || task.project?.id;
    if (!projectId || !isAuth) return;

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const maxFileSize = 10 * 1024 * 1024;
      const allowedTypes = [
        // Images
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",

        // Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        // Text
        "text/plain",
        "text/csv",

        // Videos
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/mpeg",
        "video/quicktime", // .mov
        "video/x-msvideo", // .avi
        "video/x-matroska", // .mkv
      ];

      const validFiles = Array.from(files).filter((file) => {
        if (file.size > maxFileSize) {
          toast.error(`File "${file.name}" is too large. Maximum size is 10MB.`);
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
        const updatedAttachments = await getTaskAttachments(taskId, isAuth);
        setAttachments(updatedAttachments || []);
        toast.success(`${successfulUploads.length} file(s) uploaded successfully.`);
      }
    } catch (error) {
      toast.error("Failed to upload one or more files. Please try again.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleEmailRepliesToggle = async (enabled: boolean) => {
    try {
      await updateTask(taskId, {
        allowEmailReplies: enabled,
      });
      setAllowEmailReplies(enabled);
      task.allowEmailReplies = enabled;
      toast.success(`Email replies ${enabled ? "enabled" : "disabled"} successfully.`);
    } catch (error) {
      toast.error("Failed to update email replies setting.");
      // Revert the state if the update failed
      setAllowEmailReplies(!enabled);
    }
  };

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
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
        error instanceof Error ? error.message : "Failed to add label. Please try again."
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
        message: "Are you sure you want to delete this attachment? This action cannot be undone.",
        type: "danger",
        onConfirm: async () => {
          try {
            await deleteAttachment(attachmentId, currentUser.id);
            const updatedAttachments = await getTaskAttachments(taskId, isAuth);
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
    setIsEditingTask({
      title: true,
      description: true,
      priority: false,
      status: false,
      dueDate: false,
      startDate: false,
      taskType: false,
    });
  };

  const handleSaveTaskEdit = async (e?: React.FormEvent, updatedDescription?: string) => {
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
        dueDate: editTaskData.dueDate ? formatDateForApi(editTaskData.dueDate) : undefined,
        remainingEstimate: task.remainingEstimate || 0,
        assigneeIds: assignees.map((a) => a.id),
        reporterIds: reporters.map((r) => r.id),
        statusId: task.status?.id || task.statusId,
        projectId: task.projectId || task.project?.id,
      });

      Object.assign(task, updatedTask);
      setIsEditingTask({
        title: false,
        description: false,
        priority: false,
        status: false,
        dueDate: false,
        startDate: false,
        taskType: false,
      });
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
            priority: typeof task.priority === "object" ? task.priority?.name : task.priority,
            dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
            startDate: task.startDate ? task.startDate.split("T")[0] : "",
            taskType: task.type || task.taskType || "",
          });
          setIsEditingTask({
            title: false,
            description: false,
            priority: false,
            status: false,
            dueDate: false,
            startDate: false,
            taskType: false,
          });
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setIsEditingTask({
        title: false,
        description: false,
        priority: false,
        status: false,
        dueDate: false,
        startDate: false,
        taskType: false,
      });
    }
  };

  const handleTaskFieldChange = (field: string, value: string) => {
    setEditTaskData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDeleteTask = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Task",
      message: "Are you sure you want to delete this task? This action cannot be undone.",
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
        const foundAssignee = projectMembers.find((member) => member.id === task.assigneeId);
        if (foundAssignee) updatedAssignee = [foundAssignee];
      }
      if (task.reporterId) {
        const foundReporter = projectMembers.find((member) => member.id === task.reporterId);
        if (foundReporter) updatedReporter = [foundReporter];
      }
      setAssignees(updatedAssignee);
      setReporters(updatedReporter);
    }
  }, [projectMembers, task.assigneeId, task.reporterId]);

  // Validate task.id before URL construction
  const detailUrl = (() => {
    if (!validator.isUUID(task.id, 4)) {
      console.error('Invalid task ID format:', task.id);
      return '';
    }

    const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
    const safeProjectSlug = sanitizeSlug(projectSlug);

    if (safeWorkspaceSlug && safeProjectSlug) {
      return `/${safeWorkspaceSlug}/${safeProjectSlug}/tasks/${task.id}`;
    } else if (safeWorkspaceSlug) {
      return `/${safeWorkspaceSlug}/tasks/${task.id}`;
    } else {
      return `/tasks/${task.id}`;
    }
  })();

  const isInitialLoading = !initialLoadComplete || !minLoadTimeElapsed;

  if (isInitialLoading) {
    return <TaskDetailSkeleton />;
  }

  return (
    <div className="dashboard-container">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-[var(--foreground)] capitalize">
                {task.title}
              </h1>
              <div className="flex items-center gap-2">
                {open === "modal" && (
                  <div className="absolute -top-[25px] right-11 z-50">
                    {isAuth && (
                      <Tooltip content="Expand to full screen" position="left">
                        <div onClick={() => {
                          if (isValidInternalPath(detailUrl)) {
                            router.push(detailUrl);
                          } else {
                            router.push('/');
                          }
                        }}>
                          <CgArrowsExpandRight className="size-[17px] stroke-[0.5px] cursor-pointer" />
                        </div>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Created By Info */}
            <span className="text-sm text-[var(--muted-foreground)]">
              {task.createdByUser
                ? `Created by ${task.createdByUser.firstName} ${task.createdByUser.lastName}`
                : task.emailThreadId
                  ? "Created from mail"
                  : ""}
            </span>
          </div>

          {(hasAccess || task.createdBy === currentUser?.id) && (
            <div className=" flex gap-2">
              {!task.emailThreadId && (
                <Tooltip content="Edit task" position="left">
                  <ActionButton
                    onClick={handleEditTask}
                    variant="outline"
                    secondary
                    className="cursor-pointer justify-center px-3"
                  >
                    <HiPencil className="w-4 h-4" />
                  </ActionButton>
                </Tooltip>
              )}
              <Tooltip content="Delete task" position="left">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 p-0 justify-between">
          <div className="lg:col-span-2  space-y-6">
            <div className="border-none ">
              {isEditingTask.title || isEditingTask.description ? (
                <div className="space-y-4">
                  <Input
                    value={editTaskData.title}
                    onChange={(e) => handleTaskFieldChange("title", e.target.value)}
                    placeholder="Task title"
                    className="text-xs bg-[var(--background)] border-[var(--border)]"
                  />
                  <TaskDescription
                    value={editTaskData.description}
                    onChange={(value) => handleTaskFieldChange("description", value)}
                    editMode={true}
                  />
                  <div className="flex items-center justify-end gap-4 mt-4">
                    <ActionButton
                      onClick={handleSaveTaskEdit}
                      variant="outline"
                      primary
                      disabled={!hasUnsavedChanges}
                      className="justify-center bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--primary)]"
                    >
                      Save Changes
                    </ActionButton>
                    <ActionButton
                      onClick={handleCancelTaskEdit}
                      secondary
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
                  onChange={(value) => handleTaskFieldChange("description", value)}
                  onSaveRequest={handleCheckboxSave}
                  emailThreadId={task.emailThreadId}
                />
              )}
            </div>

            <TaskAttachments
              attachments={attachments}
              isUploading={isUploading}
              loadingAttachments={loadingAttachments}
              onFileUpload={handleFileUpload}
              onDownloadAttachment={handleDownloadAttachment}
              onDeleteAttachment={handleDeleteAttachment}
              hasAccess={hasAccess}
              setLoading={setLoadingAttachments}
            />

            {!task.parentTaskId && (
              <div className="">
                <Subtasks
                  taskId={taskId}
                  projectId={task.projectId || task.project?.id}
                  onSubtaskAdded={() => {}}
                  onSubtaskUpdated={() => {}}
                  onSubtaskDeleted={() => {}}
                  showConfirmModal={showConfirmModal}
                  isAssignOrRepoter={hasAccess}
                  setLoading={setLoadingSubtasks}
                />
              </div>
            )}

            <div className="">
              <TaskComments
                taskId={taskId}
                projectId={task?.projectId || ""}
                allowEmailReplies={task?.allowEmailReplies || false}
                onCommentAdded={() => {
                  onTaskRefetch && onTaskRefetch();
                }}
                onCommentUpdated={() => {
                  onTaskRefetch && onTaskRefetch();
                }}
                onCommentDeleted={() => {
                  onTaskRefetch && onTaskRefetch();
                }}
                hasAccess={hasAccess}
                setLoading={setLoadingComments}
              />
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4 lg:max-w-[18vw] w-full">
            {/* Task Settings Section */}
            <div className="">
              <div className="space-y-2">
                {task.showEmailReply && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm">Email Replies</Label>
                      <ToggleSwitch
                        checked={allowEmailReplies}
                        onChange={handleEmailRepliesToggle}
                        disabled={!hasAccess}
                        label="Allow email replies"
                        size="sm"
                      />
                    </div>
                  </div>
                )}

                {/* Task Type */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Task Type</Label>
                    {hasAccess && (
                      <button
                        type="button"
                        className="rounded transition flex items-center cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs p-1"
                        onClick={() => {
                          setIsEditingTask((prev) => ({
                            ...prev,
                            taskType: true,
                          }));
                          setAutoOpenDropdown((prev) => ({
                            ...prev,
                            taskType: true,
                          }));
                        }}
                        tabIndex={0}
                        aria-label="Edit Task Type"
                        style={{ lineHeight: 0 }}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Conditionally render badge or dropdown */}
                  <div className="mt-2">
                    {isEditingTask.taskType ? (
                      <DropdownAction
                        currentItem={
                          editTaskData.taskType
                            ? {
                                id: editTaskData.taskType,
                                name:
                                  TASK_TYPE_OPTIONS.find(
                                    (type) => type.value === editTaskData.taskType
                                  )?.label || "Task",
                                color: "#6B7280",
                              }
                            : {
                                id: "",
                                name: "Select task type",
                                color: "#6B7280",
                              }
                        }
                        availableItems={TASK_TYPE_OPTIONS.map((type) => ({
                          id: type.value,
                          name: type.label,
                          color: "#6B7280",
                        }))}
                        loading={false}
                        forceOpen={autoOpenDropdown.taskType}
                        onOpenStateChange={(isOpen) => {
                          if (!isOpen) {
                            setAutoOpenDropdown((prev) => ({
                              ...prev,
                              taskType: false,
                            }));
                            setIsEditingTask((prev) => ({
                              ...prev,
                              taskType: false,
                            }));
                          }
                        }}
                        onItemSelect={async (item) => {
                          try {
                            const updateData: UpdateTaskRequest = {
                              type: item.id as "TASK" | "STORY" | "BUG" | "EPIC" | "SUBTASK",
                            };
                            await updateTask(taskId, updateData);
                            handleTaskFieldChange("taskType", item.id);
                            task.type = item.id;
                            task.taskType = item.id;
                            setIsEditingTask((prev) => ({
                              ...prev,
                              taskType: false,
                            }));
                            setAutoOpenDropdown((prev) => ({
                              ...prev,
                              taskType: false,
                            }));
                            toast.success("Task type updated successfully.");
                          } catch (error) {
                            toast.error("Failed to update task type.");
                          }
                        }}
                        placeholder="Select task type..."
                        showUnassign={false}
                        hideAvatar={true}
                        hideSubtext={true}
                        itemType="user"
                      />
                    ) : editTaskData.taskType ? (
                      <DynamicBadge
                        label={
                          TASK_TYPE_OPTIONS.find((type) => type.value === editTaskData.taskType)
                            ?.label || "Task"
                        }
                        bgColor={getTaskTypeHexColor(
                          editTaskData.taskType as keyof typeof TaskTypeIcon
                        )}
                        textColor="#FFFFFF"
                        size="sm"
                        variant="solid"
                        className="flex-shrink-0 min-w-[120px] min-h-[29.33px] text-[13px]"
                      />
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[13px] h-5 min-h-0 px-1.5 py-0.5 bg-[var(--muted)] border-[var(--border)] flex-shrink-0"
                      >
                        No task type
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Priority</Label>
                    {hasAccess && (
                      <button
                        type="button"
                        className="rounded transition flex items-center cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs p-1"
                        onClick={() => {
                          setIsEditingTask((prev) => ({
                            ...prev,
                            priority: true,
                          }));
                          setAutoOpenDropdown((prev) => ({
                            ...prev,
                            priority: true,
                          }));
                        }}
                        tabIndex={0}
                        aria-label="Edit Priority"
                        style={{ lineHeight: 0 }}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Conditionally render badge or dropdown */}
                  <div className="mt-2">
                    {isEditingTask.priority ? (
                      <DropdownAction
                        currentItem={{
                          id: editTaskData.priority || "MEDIUM",
                          name:
                            editTaskData.priority?.charAt(0).toUpperCase() +
                              editTaskData.priority?.slice(1).toLowerCase() || "Medium",
                          color: task.priority?.color || "#F59E0B",
                        }}
                        availableItems={TaskPriorities}
                        loading={false}
                        forceOpen={autoOpenDropdown.priority}
                        onOpenStateChange={(isOpen) => {
                          if (!isOpen) {
                            setAutoOpenDropdown((prev) => ({
                              ...prev,
                              priority: false,
                            }));
                            setIsEditingTask((prev) => ({
                              ...prev,
                              priority: false,
                            }));
                          }
                        }}
                        onItemSelect={async (item) => {
                          try {
                            const updateData: UpdateTaskRequest = {
                              priority: item.id as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
                            };
                            await updateTask(taskId, updateData);
                            handleTaskFieldChange("priority", item.id);
                            task.priority = {
                              name: item,
                              id: item.id,
                            };
                            setIsEditingTask((prev) => ({
                              ...prev,
                              priority: false,
                            }));
                            setAutoOpenDropdown((prev) => ({
                              ...prev,
                              priority: false,
                            }));
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
                      <PriorityBadge
                        priority={editTaskData?.priority}
                        className="text-[13px] min-w-[120px] min-h-[29.33px]"
                      />
                    )}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Status</Label>
                    {hasAccess && (
                      <button
                        type="button"
                        className="rounded transition flex items-center cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs p-1"
                        onClick={() => {
                          setIsEditingTask((prev) => ({
                            ...prev,
                            status: true,
                          }));
                          setAutoOpenDropdown((prev) => ({
                            ...prev,
                            status: true,
                          }));
                        }}
                        tabIndex={0}
                        aria-label="Edit Status"
                        style={{ lineHeight: 0 }}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Conditionally render badge or dropdown */}
                  <div className="mt-2">
                    {isEditingTask.status ? (
                      <DropdownAction
                        currentItem={currentStatus}
                        availableItems={statuses}
                        loading={loadingStatuses}
                        forceOpen={autoOpenDropdown.status}
                        onOpenStateChange={(isOpen) => {
                          if (!isOpen) {
                            setAutoOpenDropdown((prev) => ({
                              ...prev,
                              status: false,
                            }));
                            setIsEditingTask((prev) => ({
                              ...prev,
                              status: false,
                            }));
                          }
                        }}
                        onItemSelect={async (item) => {
                          await handleStatusChange(item);
                          setIsEditingTask((prev) => ({
                            ...prev,
                            status: false,
                          }));
                          setAutoOpenDropdown((prev) => ({
                            ...prev,
                            status: false,
                          }));
                        }}
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
                                const allStatuses = await getTaskStatusByProject(projectId);
                                setStatuses(allStatuses || []);
                              } catch (error) {
                                toast.error("Failed to fetch task statuses");
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <StatusBadge status={currentStatus} className="text-[13px]" />
                    )}
                  </div>
                </div>

                {/* Date Range Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Date Range</Label>
                    {hasAccess && (
                      <button
                        type="button"
                        className="rounded transition flex items-center cursor-pointer p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs"
                        onClick={() =>
                          setIsEditingTask((prev) => ({
                            ...prev,
                            startDate: !prev.startDate,
                            dueDate: !prev.dueDate,
                          }))
                        }
                        tabIndex={0}
                        aria-label="Edit Dates"
                        style={{ lineHeight: 0 }}
                      >
                        {isEditingTask.startDate ? "Done" : "Edit"}
                      </button>
                    )}
                  </div>

                  {/* Start Date */}
                  <div className="mb-3">
                    <Label className="text-xs text-[var(--muted-foreground)] mb-1.5 block">
                      Start Date
                    </Label>
                    {isEditingTask.startDate ? (
                      <div className="relative">
                        <Input
                          type="date"
                          value={editTaskData.startDate}
                          max={editTaskData.dueDate || undefined}
                          onChange={(e) => {
                            handleStartDateChange(e.target.value);
                          }}
                          onBlur={(e) => {
                            if (
                              e.target.value !==
                              (task.startDate ? task.startDate.split("T")[0] : "")
                            ) {
                              saveStartDate(e.target.value);
                            }
                          }}
                          className="text-xs bg-[var(--background)] border-[var(--border)] w-full cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          placeholder="Select start date..."
                        />
                        {editTaskData.startDate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartDateChange("");
                              saveStartDate("");
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs z-10"
                            title="Clear start date"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[13px] min-w-[120px] min-h-[29.33px] rounded-2xl  px-1.5 py-0.5 bg-[var(--muted)] border-[var(--border)] flex-shrink-0"
                      >
                        {editTaskData.startDate
                          ? new Date(editTaskData.startDate).toLocaleDateString()
                          : "No start date"}
                      </Badge>
                    )}
                  </div>

                  {/* Due Date */}
                  <div>
                    <Label className="text-xs text-[var(--muted-foreground)] mb-1.5 block">
                      Due Date
                    </Label>
                    {isEditingTask.dueDate ? (
                      <div className="relative">
                        <Input
                          type="date"
                          value={editTaskData.dueDate}
                          min={editTaskData.startDate || undefined}
                          onChange={(e) => {
                            handleDueDateChange(e.target.value);
                          }}
                          onBlur={(e) => {
                            if (
                              e.target.value !== (task.dueDate ? task.dueDate.split("T")[0] : "")
                            ) {
                              saveDueDate(e.target.value);
                            }
                          }}
                          className="text-xs bg-[var(--background)] border-[var(--border)] w-full cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          placeholder="Select due date..."
                        />
                        {editTaskData.dueDate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDueDateChange("");
                              saveDueDate("");
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
                        className="min-w-[120px] min-h-[29.33px] text-[13px] rounded-2xl  px-1.5 py-0.5 bg-[var(--muted)] border-[var(--border)] flex-shrink-0"
                      >
                        {editTaskData.dueDate
                          ? new Date(editTaskData.dueDate).toLocaleDateString()
                          : "No due date"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <Divider label="Assignment" />
            {/* Assignment Section */}
            <div className="space-y-4">
              <div>
                <MemberSelect
                  label="Assignees"
                  editMode={isAuth && hasAccess}
                  selectedMembers={assignees}
                  projectId={task.projectId || task.project?.id}
                  onChange={async (newAssignees) => {
                    setAssignees(newAssignees);
                    try {
                      await assignTaskAssignees(
                        taskId,
                        newAssignees.map((a) => a.id)
                      );
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
                  editMode={isAuth && hasAccess}
                  projectId={task.projectId || task.project?.id}
                  onChange={async (newReporters) => {
                    setReporters(newReporters);
                    try {
                      await updateTask(taskId, {
                        reporterIds: newReporters.map((r) => r.id),
                      });
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
            <Divider label="Labels" />
            {/* Labels Section */}
            <TaskLabels
              labels={labels}
              availableLabels={availableLabels}
              onAddLabel={handleAddLabel}
              onAssignExistingLabel={handleAssignExistingLabel}
              onRemoveLabel={handleRemoveLabel}
              hasAccess={hasAccess}
              setLoading={setLoadingLabels}
            />
            <Divider label="Activities" />

            <TaskActivities taskId={taskId} setLoading={setLoadingActivities} />
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
