import { PublicSharedTask, shareApi } from '@/utils/api/shareApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { HiCalendar, HiUser, HiPaperClip, HiArrowDownTray } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface PublicTaskViewProps {
  task: PublicSharedTask;
  token: string;
}

export default function PublicTaskView({ task, token }: PublicTaskViewProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'URGENT':
      case 'HIGHEST': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Branding */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <span className="bg-primary text-primary-foreground p-1 rounded-md text-sm">TS</span>
            <span>Taskosaur</span>
            <Badge variant="outline" className="ml-2 font-normal text-xs">Shared View</Badge>
          </div>
        </div>

        {/* Main Task Card */}
        <Card className="border-none shadow-lg">
          <CardContent className="p-6 md:p-10 space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge 
                  className={getPriorityColor(task.priority)} 
                  variant="secondary"
                >
                  {task.priority}
                </Badge>
                <Badge 
                  style={{ backgroundColor: task.status.color + '20', color: task.status.color }}
                  variant="outline"
                  className="border-transparent"
                >
                  {task.status.name}
                </Badge>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {task.title}
              </h1>

              <div className="flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400 border-t border-b py-4 border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <HiCalendar className="h-5 w-5 opacity-70" />
                  <span>Due {formatDate(task.dueDate)}</span>
                </div>
                
                {task.assignees.length > 0 && (
                  <div className="flex items-center gap-2">
                    <HiUser className="h-5 w-5 opacity-70" />
                    <div className="flex -space-x-2">
                      {task.assignees.map((assignee, i) => (
                        <Avatar key={i} className="h-6 w-6 border-2 border-white dark:border-gray-900">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(assignee.firstName, assignee.lastName)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="ml-2">
                      {task.assignees.map(a => a.firstName).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {task.description}
                </ReactMarkdown>
              </div>
            )}

            {/* Attachments */}
            {task.attachments && task.attachments.length > 0 && (
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <HiPaperClip className="h-4 w-4" />
                  Attachments ({task.attachments.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {task.attachments.map((file) => (
                    <div 
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-md border bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-white dark:bg-gray-800 p-2 rounded border shadow-sm">
                          <HiPaperClip className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{file.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {(file.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(file)}
                      >
                        <HiArrowDownTray className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 py-4">
          <p>Shared securely via Taskosaur</p>
        </div>
      </div>
    </div>
  );
}
