import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HiDocumentText, HiCog, HiUsers, HiPaperClip, HiTrash } from "react-icons/hi2";

import TaskDescription from "@/components/tasks/views/TaskDescription";
import { useTask } from "@/contexts/task-context";
import { TaskPriorities } from "@/utils/data/taskData";
import { toast } from "sonner";
import router from "next/router";
import ActionButton from "./ActionButton";
import { useProject } from "@/contexts/project-context";
import { formatDateForApi, getTodayDate } from "@/utils/handleDateChange";
import MemberSelect from "./MemberSelect";
import { Plus } from "lucide-react";
import { Button } from "../ui";

interface CreateTaskProps {
  workspaceSlug?: string;
  projectSlug?: string;
  workspace: string | { id: string; name: string };
  projects: any[];
}

const TaskSectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon size={16} className="text-[var(--primary)]" />
    <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
  </div>
);

export default function CreateTask({ projectSlug, workspace, projects }: CreateTaskProps) {
  const { createTaskWithAttachements } = useTask();
  const { getProjectMembers, getTaskStatusByProject } = useProject();

  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "",
    priority: "MEDIUM",
    type: "TASK",
    dueDate: "",
  });
  const [assignees, setAssignees] = useState<any[]>([]);
  const [reporters, setReporters] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = (): boolean => {
    const hasTitle = formData.title.trim().length > 0;
    const hasProject = selectedProject?.id;
    const hasStatus = formData.status.length > 0;
    const hasPriority = formData.priority.length > 0;
    const hasAssignment = assignees.length > 0 || reporters.length > 0;
    return hasTitle && hasProject && hasStatus && hasPriority && hasAssignment;
  };

  const handleFormDataChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProjectChange = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    setSelectedProject(project);
    setAssignees([]);
    setReporters([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    setAttachments((prev) => [...prev, ...droppedFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  useEffect(() => {
    const fetchProjectMembers = async (projectId: string) => {
      if (!projectId || !getProjectMembers) return;

      // setMembersLoading(true);
      try {
        const fetchedMembers = await getProjectMembers(projectId);

        const normalizedMembers = Array.isArray(fetchedMembers)
          ? fetchedMembers.map((m) => ({
              id: m.user?.id || m.id,
              firstName: m.user?.firstName || "",
              lastName: m.user?.lastName || "",
              email: m.user?.email || "",
              role: m.role,
            }))
          : [];

        setMembers(normalizedMembers);
      } catch (error) {
        console.error("Failed to fetch project members:", error);
        setMembers([]);
        toast.error("Failed to load project members");
      } finally {
        // setMembersLoading(false);
      }
    };

    const fetchProjectStatuses = async (projectId: string) => {
      if (!projectId || !getTaskStatusByProject) return;

      try {
        const statuses = await getTaskStatusByProject(projectId);
        setAvailableStatuses(statuses);
      } catch (error) {
        console.error("Failed to fetch project statuses:", error);
        setAvailableStatuses([]);
        toast.error("Failed to load project statuses");
      }
    };

    if (selectedProject?.id) {
      fetchProjectMembers(selectedProject.id);
      fetchProjectStatuses(selectedProject.id);
    } else {
      setMembers([]);
      setAvailableStatuses([]);
    }
  }, [selectedProject?.id]);

  useEffect(() => {
    if (projectSlug && projects.length > 0) {
      const project = projects.find((p) => p.slug === projectSlug);
      if (project && selectedProject?.id !== project.id) {
        setSelectedProject(project);
      }
    } else if (projects.length === 1 && !selectedProject) {
      setSelectedProject(projects[0]);
    }
  }, [projectSlug, projects, selectedProject?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSubmitting(true);
    try {
      const taskData: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || "",
        priority: formData.priority.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
        type: formData.type as "TASK" | "BUG" | "EPIC" | "STORY" | "SUBTASK",
        startDate: new Date().toISOString(),
        dueDate: formData.dueDate
          ? formatDateForApi(formData.dueDate)
          : formatDateForApi(getTodayDate()),
        projectId: selectedProject.id,
        statusId: formData.status,
      };

      if (assignees.length > 0) taskData.assigneeIds = assignees.map((a) => a.id);
      if (reporters.length > 0) taskData.reporterIds = reporters.map((r) => r.id);
      if (attachments.length > 0) taskData.attachments = attachments;

      const newTask = await createTaskWithAttachements(taskData);

      toast.success(`Task named ${newTask.title} created successfully!`);
      router.back();
    } catch (error: any) {
      toast.error(error?.message || "Error creating task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form id="create-task-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
              <CardHeader className="pb-0">
                <TaskSectionHeader icon={HiDocumentText} title="Basic Information" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Task Title <span className="projects-form-label-required">*</span>
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => handleFormDataChange("title", e.target.value)}
                    placeholder="What needs to be done?"
                    className="border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
              <CardHeader className="flex items-center justify-between pb-2">
                <TaskSectionHeader
                  icon={HiPaperClip}
                  title={`Attachment(s) ${attachments.length > 0 ? `(${attachments.length})` : ""}`}
                />
                <div>
                  <Input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    accept="*/*"
                  />
                  <Label
                    htmlFor="file-upload"
                    className="py-2 relative h-9 px-4 bg-[var(--primary)] cursor-pointer rounded-md hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Attachment</span>
                  </Label>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-[var(--background)] border border-[var(--border)] rounded-md"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <HiPaperClip
                              size={16}
                              className="text-[var(--muted-foreground)] flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => removeAttachment(index)}
                            className="flex-shrink-0 ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                            aria-label="Remove file"
                          >
                            <HiTrash className="w-4 h-4 text-[var(--destructive)]" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center pt-5">No Attachment(s) </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
              <CardHeader className="pb-0">
                <TaskSectionHeader icon={HiDocumentText} title="Description" />
              </CardHeader>
              <CardContent className="space-y-4">
                <TaskDescription
                  value={formData.description}
                  onChange={(value) => handleFormDataChange("description", value)}
                  editMode={true}
                />
              </CardContent>
            </Card>
          </form>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
            <CardHeader>
              <TaskSectionHeader icon={HiCog} title="Workspace & Project" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace">
                  Workspace <span className="projects-form-label-required">*</span>
                </Label>
                <Input
                  id="workspace"
                  value={
                    workspace && typeof workspace === "object" && workspace !== null
                      ? (workspace.name ?? "")
                      : typeof workspace === "string"
                        ? workspace
                        : ""
                  }
                  readOnly
                  className="w-full border-[var(--border)] bg-[var(--background)] cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">
                  Project <span className="projects-form-label-required">*</span>
                </Label>
                {projects.length === 1 && projects[0] ? (
                  <Input
                    id="project"
                    value={projects[0].name}
                    readOnly
                    className="w-full border-[var(--border)] bg-[var(--background)] cursor-not-allowed"
                  />
                ) : (
                  <Select value={selectedProject?.id || ""} onValueChange={handleProjectChange}>
                    <SelectTrigger className="w-full border-[var(--border)] bg-[var(--background)]">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                      {projects.map((project) => (
                        <SelectItem
                          className="hover:bg-[var(--hover-bg)]"
                          key={project.id}
                          value={project.id}
                        >
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
            <CardHeader>
              <TaskSectionHeader icon={HiCog} title="Task Configuration" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="projects-form-label-required">*</span>
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleFormDataChange("status", value)}
                  disabled={availableStatuses.length === 0}
                >
                  <SelectTrigger className="w-full border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                    {availableStatuses.length > 0 ? (
                      availableStatuses.map((status) => (
                        <SelectItem
                          className="hover:bg-[var(--hover-bg)]"
                          key={status.id}
                          value={status.id}
                        >
                          {status.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__loading" disabled>
                        Loading statuses...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">
                  Priority <span className="projects-form-label-required">*</span>
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => handleFormDataChange("priority", value)}
                >
                  <SelectTrigger className="w-full border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                    {TaskPriorities.map((priority) => (
                      <SelectItem
                        className="hover:bg-[var(--hover-bg)]"
                        key={priority.value}
                        value={priority.value}
                      >
                        {priority.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">
                  Task Type <span className="projects-form-label-required">*</span>
                </Label>
                <Select
                  value={formData.type || "TASK"}
                  onValueChange={(value) => handleFormDataChange("type", value)}
                >
                  <SelectTrigger className="w-full border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                    {[
                      { value: "TASK", name: "Task" },
                      { value: "BUG", name: "Bug" },
                      { value: "EPIC", name: "Epic" },
                      { value: "STORY", name: "Story" },
                      { value: "SUBTASK", name: "Subtask" },
                    ].map((type) => (
                      <SelectItem
                        className="hover:bg-[var(--hover-bg)]"
                        key={type.value}
                        value={type.value}
                      >
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleFormDataChange("dueDate", e.target.value)}
                  onClick={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.showPicker?.();
                  }}
                  min={getTodayDate()}
                  className="w-full border-[var(--border)] bg-[var(--background)] cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:mt-1"
                  style={{
                    colorScheme: "dark",
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
            <CardHeader className="flex">
              <TaskSectionHeader icon={HiUsers} title="Assignment" />
              <span className="projects-form-label-required">*</span>
            </CardHeader>
            <CardContent className="space-y-4">
              {membersLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Loading project members...
                  </p>
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-red-500 text-center">No project members found.</p>
              ) : (
                <>
                  <MemberSelect
                    label="Assignees"
                    selectedMembers={assignees}
                    onChange={setAssignees}
                    members={members}
                    projectId={selectedProject?.id}
                    disabled={!selectedProject?.id || members.length === 0}
                    placeholder={
                      !selectedProject?.id ? "Select a project first" : "Select assignees..."
                    }
                  />

                  <MemberSelect
                    label="Reporters"
                    selectedMembers={reporters}
                    onChange={setReporters}
                    members={members}
                    projectId={selectedProject?.id}
                    disabled={!selectedProject?.id || members.length === 0}
                    placeholder={
                      !selectedProject?.id ? "Select a project first" : "Select reporters..."
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
          <div className="flex items-center justify-end gap-3 " id="submit-form-button">
            <ActionButton
              onClick={() => router.back()}
              variant="outline"
              secondary
              className="h-8 px-3 cursor-pointer"
            >
              Cancel
            </ActionButton>
            <ActionButton onClick={handleSubmit} disabled={!isFormValid() || isSubmitting} primary>
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating task...
                </div>
              ) : (
                "Create Task"
              )}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
