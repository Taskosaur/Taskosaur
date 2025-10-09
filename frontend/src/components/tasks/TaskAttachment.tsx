import  { useRef } from "react";
import ActionButton from "@/components/common/ActionButton";
import { ArrowDownToLine, Upload } from "lucide-react";
import { HiPaperClip, HiTrash } from "react-icons/hi2";
import Tooltip from "../common/ToolTip";
import { useAuth } from "@/contexts/auth-context";

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  mimeType?: string;
  url?: string;
  createdBy: string;
}

interface TaskAttachmentsProps {
  attachments: Attachment[];
  isUploading: boolean;
  loadingAttachments: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDownloadAttachment: (
    attachmentId: string,
    fileName: string
  ) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  hasAccess?: boolean;
}

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon size={16} className="text-[var(--primary)]" />
    <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
  </div>
);

export default function TaskAttachments({
  attachments,
  isUploading,
  loadingAttachments,
  onFileUpload,
  onDownloadAttachment,
  onDeleteAttachment,
  hasAccess = false,
}: TaskAttachmentsProps) {
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Loading state
  if (loadingAttachments) {
    return (
      <div>
        <SectionHeader icon={HiPaperClip} title="Attachments" />
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-sm text-[var(--muted-foreground)]">
            Loading attachments...
          </span>
        </div>
      </div>
    );
  }

  return (
     <div className="space-y-4">
        {/* Existing attachments list */}
        {attachments.length > 0 && (
          <div className="space-y-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg bg-[var(--muted)]/30 hover:bg-[var(--accent)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <HiPaperClip className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-[var(--foreground)] truncate">
                      {attachment.fileName}
                    </p>
                    <p className="text-[13px] text-[var(--muted-foreground)]">
                      {formatFileSize(attachment.fileSize)} •{" "}
                      {formatDate(attachment.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Tooltip content="Download" position="top" color="primary">
                    <ActionButton
                      variant="outline"
                      onClick={() =>
                        onDownloadAttachment(attachment.id, attachment.fileName)
                      }
                      secondary
                      className="h-8 px-3 text-xs cursor-pointer"
                    >
                      <ArrowDownToLine />
                    </ActionButton>
                  </Tooltip>
                  {attachment.createdBy === currentUser?.id && (
                    <Tooltip content="Delete" position="top" color="primary">
                      <ActionButton
                        onClick={() => onDeleteAttachment(attachment.id)}
                        secondary
                        className="px-3  cursor-pointer"
                      >
                        <HiTrash className="w-4 h-4 text-[var(--destructive)]" />
                      </ActionButton>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload button - only show if hasAccess */}
        {hasAccess && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              multiple
              onChange={onFileUpload}
              disabled={isUploading}
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
            />

            <div className="flex justify-end items-center w-full">
              <ActionButton
                onClick={handleButtonClick}
                disabled={isUploading}
                secondary
                showPlusIcon={!isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                    
                                              Add Attachment

                      
                    </div>
                  </>
                )}
              </ActionButton>
            </div>

          </div>
        )}
      </div>
  );
}
