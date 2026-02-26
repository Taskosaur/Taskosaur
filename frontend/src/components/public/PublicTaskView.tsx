import { PublicSharedTask, shareApi } from '@/utils/api/shareApi';
import { Badge } from '@/components/ui/badge';
import { HiCalendar, HiUser, HiPaperClip, HiArrowDownTray } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/ui/avatars/UserAvatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { PriorityBadge } from '@/components/badges/PriorityBadge';
import { Label } from '@/components/ui/label';
import Image from "next/image";
import { useTheme } from "next-themes";
import { ModeToggle } from '@/components/header/ModeToggle';

interface PublicTaskViewProps {
  task: PublicSharedTask;
  token: string;
}

export default function PublicTaskView({ task, token }: PublicTaskViewProps) {
  const { resolvedTheme } = useTheme();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDownload = async (attachment: { id: string, fileName: string }) => {
    try {
      const fileUrl = await shareApi.getAttachmentUrl(token, attachment.id);
      if (!fileUrl) throw new Error('Attachment URL not found');

      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      const fullUrl = fileUrl.startsWith('http')
        ? fileUrl
        : `${apiUrl}/uploads${fileUrl}`;

      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('Failed to fetch file');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download attachment');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto dashboard-container space-y-6">
        {/* Header / Title Area */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)] capitalize">
                {task.title}
              </h1>
              <Badge variant="outline" className="font-normal text-xs bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]">
                Shared View
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <div className="hidden sm:flex items-center gap-2 text-[var(--foreground)] font-bold text-lg">
              <Image
                src="/taskosaur-logo.svg"
                alt="Taskosaur Logo"
                width={24}
                height={24}
                className={`size-6 ${resolvedTheme === "light" ? "filter invert brightness-200" : ""
                  }`}
              />
              <span>Taskosaur</span>
            </div>
          </div>
        </div>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16 p-0 justify-between">

          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-base text-[var(--foreground)] font-semibold">Description</Label>
              {task.description ? (
                <div className="prose dark:prose-invert max-w-none text-[var(--foreground)] text-sm leading-relaxed p-4 rounded-md border border-[var(--border)] bg-[var(--background)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {task.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm text-[var(--muted-foreground)] italic p-4 rounded-md border border-[var(--border)] bg-[var(--muted)]/20">
                  No description provided.
                </div>
              )}
            </div>

            {/* Attachments */}
            {task.attachments && task.attachments.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--foreground)]">
                  <HiPaperClip className="h-4 w-4" />
                  Attachments ({task.attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {task.attachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-md border border-[var(--border)] bg-[var(--muted)]/10 hover:bg-[var(--muted)]/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-[var(--background)] p-2 rounded border border-[var(--border)] shadow-sm">
                          <HiPaperClip className="h-4 w-4 text-[var(--muted-foreground)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">{file.fileName}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {(file.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(file)}
                        className="text-[var(--foreground)] hover:text-[var(--primary)]"
                      >
                        <HiArrowDownTray className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6 lg:max-w-[18vw] w-full">

            {/* Priority */}
            <div>
              <Label className="text-sm text-[var(--foreground)] block mb-2">Priority</Label>
              <PriorityBadge
                priority={task.priority}
                className="text-[13px] min-w-[120px] min-h-[29.33px] justify-start"
              />
            </div>

            {/* Status */}
            <div>
              <Label className="text-sm text-[var(--foreground)] block mb-2">Status</Label>
              <Badge
                style={{ backgroundColor: task.status.color + '20', color: task.status.color }}
                variant="outline"
                className="border-transparent flex-shrink-0 min-w-[120px] min-h-[29.33px] text-[13px] justify-start px-3"
              >
                {task.status.name}
              </Badge>
            </div>

            {/* Due Date */}
            <div>
              <Label className="text-sm text-[var(--foreground)] block mb-2">Due Date</Label>
              <div className="flex items-center gap-2 text-[var(--foreground)] text-sm bg-[var(--muted)]/20 p-2 rounded-md border border-[var(--border)]">
                <HiCalendar className="h-4 w-4 opacity-70" />
                <span>{formatDate(task.dueDate)}</span>
              </div>
            </div>
            {task.createdBy && (
              <div>
                <Label className="text-sm text-[var(--foreground)] block mb-2">Created By</Label>
                <div className="flex items-center gap-3 mt-2">
                  <UserAvatar
                    user={{
                      ...task.createdBy,
                      avatar: (task.createdBy as any).avatarUrl || (task.createdBy as any).avatar || "/default-avatar.png",
                    }}
                    size="sm"
                  />
                  <span className="text-sm text-[var(--foreground)]">
                    {task.createdBy.firstName} {task.createdBy.lastName}
                  </span>
                </div>
              </div>
            )}
            {/* Assignees */}
            {task.assignees && task.assignees.length > 0 && (
              <div>
                <Label className="text-sm text-[var(--foreground)] block mb-2">Assignees</Label>
                <div className="space-y-3 mt-2">
                  {task.assignees.map((assignee, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <UserAvatar
                        user={{
                          ...assignee,
                          avatar: (assignee as any).avatarUrl || (assignee as any).avatar || "/default-avatar.png",
                        }}
                        size="sm"
                      />
                      <span className="text-sm text-[var(--foreground)]">
                        {assignee.firstName} {assignee.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[var(--muted-foreground)] py-8 mt-8 border-t border-[var(--border)]">
          <p>Shared securely via Taskosaur</p>
        </div>

      </div>
    </div>
  );
}
