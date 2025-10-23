import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ActionButton from '@/components/common/ActionButton';
import { ArrowDownToLine } from 'lucide-react';

interface VideoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  onDownload: () => void;
}

export function VideoPreviewModal({
  isOpen,
  onClose,
  videoUrl,
  fileName,
  fileSize,
  createdAt,
  onDownload,
}: VideoPreviewModalProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!max-w-[80vw] !w-[80vw] max-h-[90vh] p-0 overflow-hidden"
        style={{ maxWidth: '80vw', width: '80vw' }}
      >
        <DialogHeader className="px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-md font-semibold truncate">{fileName}</DialogTitle>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {formatFileSize(fileSize)} • {formatDate(createdAt)}
              </p>
            </div>
            <ActionButton
              onClick={onDownload}
              variant="outline"
              secondary
              className="h-9 px-3"
            >
              <ArrowDownToLine className="w-4 h-4" />
            </ActionButton>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-center bg-[var(--muted)]/30" style={{ height: 'calc(90vh - 100px)' }}>
          <video
            src={videoUrl}
            controls
            className="max-h-full max-w-full rounded-md shadow-md"
          >
            Your browser does not support HTML5 video.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
}
