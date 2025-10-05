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
import { HiDocumentText, HiCog, HiUsers } from "react-icons/hi2";
import TaskDescription from "@/components/tasks/views/TaskDescription";
import { useTask } from "@/contexts/task-context";
import { TaskPriorities } from "@/utils/data/taskData";
import { toast } from "sonner";
import router from "next/router";
import ActionButton from "./ActionButton";
import { useProject } from "@/contexts/project-context";
import { formatDateForApi, getTodayDate } from "@/utils/handleDateChange";
import MemberSelect from "./MemberSelect";
interface CreateTaskProps {
  workspaceSlug?: string;
  projectSlug?: string;
  workspace: string | { id: string; name: string };
  projects: any[];
}

const TaskSectionHeader = ({
  icon: Icon,
  title,
}: {
  icon: any;
  title: string;
}) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon size={16} className="text-[var(--primary)]" />
    <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
  </div>
);
export default function CreateTask({
  projectSlug,
  workspace,
  projects,
}: CreateTaskProps) {
  const { createTask } = useTask();
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

  useEffect(() => {
    const fetchProjectMembers = async (projectId: string) => {
      if (!projectId || !getProjectMembers) return;

      setMembersLoading(true);
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
        setMembersLoading(false);
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
        priority: formData.priority.toUpperCase() as
          | "LOW"
          | "MEDIUM"
          | "HIGH"
          | "HIGHEST",
        type: formData.type as "TASK" | "BUG" | "EPIC" | "STORY" | "SUBTASK",
        startDate: new Date().toISOString(),
        dueDate: formData.dueDate
          ? formatDateForApi(formData.dueDate)
          : formatDateForApi(getTodayDate()),
        projectId: selectedProject.id,
        statusId: formData.status,
      };

      if (assignees.length > 0)
        taskData.assigneeIds = assignees.map((a) => a.id);
      if (reporters.length > 0)
        taskData.reporterIds = reporters.map((r) => r.id);

      const newTask = await createTask(taskData);

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
          <form
            id="create-task-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
          >
            <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
              <CardHeader className="pb-0">
                <TaskSectionHeader
                  icon={HiDocumentText}
                  title="Basic Information"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Task Title{" "}
                    <span className="projects-form-label-required">*</span>
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) =>
                      handleFormDataChange("title", e.target.value)
                    }
                    placeholder="What needs to be done?"
                    className="border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-[var(--card)] gap-0 rounded-md">
              <CardHeader className="pb-0">
                <TaskSectionHeader icon={HiDocumentText} title="Description" />
              </CardHeader>
              <CardContent className="space-y-4">
                <TaskDescription
                  value={formData.description}
                  onChange={(value) =>
                    handleFormDataChange("description", value)
                  }
                  editMode={true}
                />

                <div
                  className="flex items-center justify-start gap-3 "
                  id="submit-form-button"
                >
                  <ActionButton
                    onClick={handleSubmit}
                    showPlusIcon
                    disabled={!isFormValid() || isSubmitting}
                    primary
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Creating...
                      </>
                    ) : (
                      "Create Task"
                    )}
                  </ActionButton>
                </div>
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
                  Workspace{" "}
                  <span className="projects-form-label-required">*</span>
                </Label>
                <Input
                  id="workspace"
                  value={
                    workspace &&
                    typeof workspace === "object" &&
                    workspace !== null
                      ? workspace.name ?? ""
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
                  Project{" "}
                  <span className="projects-form-label-required">*</span>
                </Label>
                {projects.length === 1 && projects[0] ? (
                  <Input
                    id="project"
                    value={projects[0].name}
                    readOnly
                    className="w-full border-[var(--border)] bg-[var(--background)] cursor-not-allowed"
                  />
                ) : (
                  <Select
                    value={selectedProject?.id || ""}
                    onValueChange={handleProjectChange}
                  >
                    <SelectTrigger className="w-full border-[var(--border)] bg-[var(--background)]">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
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
                  onValueChange={(value) =>
                    handleFormDataChange("status", value)
                  }
                  disabled={availableStatuses.length === 0}
                >
                  <SelectTrigger className="w-full border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                    {availableStatuses.length > 0 ? (
                      availableStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
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
                  Priority{" "}
                  <span className="projects-form-label-required">*</span>
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    handleFormDataChange("priority", value)
                  }
                >
                  <SelectTrigger className="w-full border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                    {TaskPriorities.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">
                  Task Type{" "}
                  <span className="projects-form-label-required">*</span>
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
                      <SelectItem key={type.value} value={type.value}>
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
                  onChange={(e) =>
                    handleFormDataChange("dueDate", e.target.value)
                  }
                  min={getTodayDate()}
                  className="w-full border-[var(--border)] bg-[var(--background)]"
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
                <p className="text-sm text-red-500 text-center">
                  No project members found.
                </p>
              ) : (
                <>
                  <MemberSelect
                    label="Assignees"
                    selectedMembers={assignees}
                    onChange={setAssignees}
                    members={members}
                    disabled={!selectedProject?.id || members.length === 0}
                    placeholder={
                      !selectedProject?.id
                        ? "Select a project first"
                        : "Select assignees..."
                    }
                  />

                  <MemberSelect
                    label="Reporters"
                    selectedMembers={reporters}
                    onChange={setReporters}
                    members={members}
                    disabled={!selectedProject?.id || members.length === 0}
                    placeholder={
                      !selectedProject?.id
                        ? "Select a project first"
                        : "Select reporters..."
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


