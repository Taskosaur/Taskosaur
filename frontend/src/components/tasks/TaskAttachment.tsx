import React, { useState } from "react";
import ActionButton from "@/components/common/ActionButton";
import { ArrowDownToLine } from "lucide-react";
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

  const [dragActive, setDragActive] = useState(false);

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

  // Handle drag & drop
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = e.dataTransfer.files as FileList;
      const event = {
        target: { files: fileList },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      onFileUpload(event);
      e.dataTransfer.clearData();
    }
  };

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

  if (!loadingAttachments && attachments.length === 0) {
    return (
      <div>
        <SectionHeader icon={HiPaperClip} title="Attachments" />
        <div className="flex flex-col items-center pb-2 justify-center text-[var(--muted-foreground)]">
          <p className="text-sm">No attachments yet</p>
        </div>
        {hasAccess && (
          <div className="space-y-3">
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={onFileUpload}
              disabled={isUploading}
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
            />

            <label
              htmlFor="file-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`block w-full p-6 border-2 border-dashed rounded-lg text-sm cursor-pointer transition-colors ${
                dragActive
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : isUploading
                  ? "text-[var(--muted-foreground)] cursor-not-allowed border-[var(--muted)]"
                  : "text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <HiPaperClip className="w-6 h-6" />
                <div className="text-center">
                  <span className="font-medium">
                    {isUploading
                      ? "Uploading files..."
                      : dragActive
                      ? "Drop files to upload"
                      : "Click or drag files to upload"}
                  </span>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1">
                    PNG, JPG, PDF, DOC, XLS up to 10MB each
                  </div>
                </div>
              </div>
            </label>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        icon={HiPaperClip}
        title={`Attachments (${attachments.length})`}
      />

      <div className="space-y-4">
        {/* Existing attachments */}
        {attachments.length > 0 && (
          <div className="space-y-3 mb-6">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg bg-[var(--muted)]/30 hover:bg-[var(--accent)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <HiPaperClip className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
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
                        variant="outline"
                        onClick={() => onDeleteAttachment(attachment.id)}
                        className="border-none cursor-pointer bg-[var(--destructive)]/5 hover:bg-[var(--destructive)]/10 text-[var(--destructive)]"
                      >
                        <HiTrash className="w-4 h-4" />
                      </ActionButton>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload area */}
        {hasAccess && (
          <div className="space-y-3">
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={onFileUpload}
              disabled={isUploading}
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
            />

            <label
              htmlFor="file-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`block w-full p-6 border-2 border-dashed rounded-lg text-sm cursor-pointer transition-colors ${
                dragActive
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : isUploading
                  ? "text-[var(--muted-foreground)] cursor-not-allowed border-[var(--muted)]"
                  : "text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                {isUploading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-center">
                      <span className="font-medium">Uploading files...</span>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">
                        Please wait while your files are being uploaded
                      </div>
                    </div>
                  </>
                ) : dragActive ? (
                  <span className="font-medium">Drop files to upload</span>
                ) : (
                  <>
                    <HiPaperClip className="w-6 h-6" />
                    <div className="text-center">
                      <span className="font-medium">Click or drag files here</span>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">
                        PNG, JPG, PDF, DOC, XLS up to 10MB each
                      </div>
                    </div>
                  </>
                )}
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
