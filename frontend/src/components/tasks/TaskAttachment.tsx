import { useEffect, useRef, useState } from "react";
import ActionButton from "@/components/common/ActionButton";
import { ArrowDownToLine, Eye } from "lucide-react";
import { HiPaperClip, HiTrash } from "react-icons/hi2";
import Tooltip from "../common/ToolTip";
import { useAuth } from "@/contexts/auth-context";
import { AttachmentPreview, AttachmentPreviewRef } from "./attachments";

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  mimeType?: string;
  url?: string;
  filePath: string;
  createdBy: string;
}

interface TaskAttachmentsProps {
  attachments: Attachment[];
  isUploading: boolean;
  loadingAttachments: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDownloadAttachment: (attachmentId: string, fileName: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onDeleteMultipleAttachments?: (attachmentIds: string[]) => Promise<void>;
  hasAccess?: boolean;
  setLoading?: (loading: boolean) => void;
}

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon size={16} className="text-[var(--primary)]" />
    <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
  </div>
);

const TaskAttachments: React.FC<TaskAttachmentsProps> = ({
  attachments,
  isUploading,
  loadingAttachments,
  onFileUpload,
  onDownloadAttachment,
  onDeleteAttachment,
  onDeleteMultipleAttachments,
  hasAccess,
  setLoading,
}) => {
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create refs for each attachment preview
  const previewRefs = useRef<{ [key: string]: AttachmentPreviewRef | null }>({});

  // Track loading state for each attachment
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

  // Only show attachments the current user can delete for selection
  const deletableAttachments = attachments.filter(
    (a) => a.createdBy === currentUser?.id
  );

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === deletableAttachments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableAttachments.map((a) => a.id)));
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeletingMultiple(true);
    try {
      if (onDeleteMultipleAttachments) {
        await onDeleteMultipleAttachments(Array.from(selectedIds));
      }
      exitSelectMode();
    } catch {
      // errors handled by parent
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  useEffect(() => {
    if (setLoading) {
      setLoading(loadingAttachments);
    }
  }, [loadingAttachments]);

  // Poll for loading state changes from refs
  useEffect(() => {
    const interval = setInterval(() => {
      const newLoadingStates: { [key: string]: boolean } = {};
      attachments.forEach((attachment) => {
        const ref = previewRefs.current[attachment.id];
        if (ref) {
          newLoadingStates[attachment.id] = ref.isLoading;
        }
      });
      setLoadingStates(newLoadingStates);
    }, 100);

    return () => clearInterval(interval);
  }, [attachments]);

  // Exit select mode if attachments list changes (e.g. after deletion)
  useEffect(() => {
    if (isSelectMode) {
      setSelectedIds((prev) => {
        const currentIds = new Set(attachments.map((a) => a.id));
        const next = new Set<string>();
        prev.forEach((id) => {
          if (currentIds.has(id)) next.add(id);
        });
        return next;
      });
    }
  }, [attachments]);

  return (
    <div className="task-attachments-container">
      <div className="space-y-4">
        <SectionHeader icon={HiPaperClip} title="Attachments" />

        {!loadingAttachments && (
          <>
            {/* Multi-select toolbar */}
            {attachments.length > 1 && deletableAttachments.length > 1 && hasAccess && (
              <div className="flex items-center justify-between gap-2">
                {isSelectMode ? (
                  <div className="flex items-center gap-3 w-full">
                    <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === deletableAttachments.length && deletableAttachments.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer"
                      />
                      Select All ({selectedIds.size}/{deletableAttachments.length})
                    </label>
                    <div className="flex items-center gap-2 ml-auto">
                      {selectedIds.size > 0 && (
                        <ActionButton
                          onClick={handleDeleteSelected}
                          disabled={isDeletingMultiple}
                          className="h-8 px-3 text-xs cursor-pointer border-none bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/20 text-[var(--destructive)]"
                        >
                          {isDeletingMultiple ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Deleting...
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <HiTrash className="w-3.5 h-3.5" />
                              Delete {selectedIds.size} selected
                            </div>
                          )}
                        </ActionButton>
                      )}
                      <ActionButton
                        onClick={exitSelectMode}
                        secondary
                        className="h-8 px-3 text-xs cursor-pointer"
                      >
                        Cancel
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center ml-auto">
                    <ActionButton
                      onClick={() => setIsSelectMode(true)}
                      secondary
                      className="h-8 px-3 text-xs cursor-pointer"
                    >
                      Select
                    </ActionButton>
                  </div>
                )}
              </div>
            )}

            {/* Existing attachments list */}
            {attachments.length > 0 && (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <div key={attachment.id}>
                    {/* Hidden AttachmentPreview component to manage modals */}
                    <AttachmentPreview
                      ref={(el) => {
                        previewRefs.current[attachment.id] = el;
                      }}
                      attachment={attachment}
                      onDownload={() => onDownloadAttachment(attachment.id, attachment.fileName)}
                    />

                    {/* Attachment bar */}
                    <div
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${isSelectMode && selectedIds.has(attachment.id)
                          ? "border-[var(--primary)] bg-[var(--primary)]/5"
                          : "border-[var(--border)] bg-[var(--muted)]/30 hover:bg-[var(--accent)]"
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Checkbox in select mode */}
                        {isSelectMode && attachment.createdBy === currentUser?.id && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(attachment.id)}
                            onChange={() => toggleSelect(attachment.id)}
                            className="w-4 h-4 rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer flex-shrink-0"
                          />
                        )}
                        {isSelectMode && attachment.createdBy !== currentUser?.id && (
                          <div className="w-4 h-4 flex-shrink-0" />
                        )}
                        <HiPaperClip className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
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

                      {!isSelectMode && (
                        <div
                          className="flex items-center gap-2 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip content="View" position="top" color="primary">
                            <ActionButton
                              variant="outline"
                              onClick={() => previewRefs.current[attachment.id]?.openPreview()}
                              secondary
                              className="h-8 px-3 text-xs cursor-pointer"
                            >
                              {loadingStates[attachment.id] ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </ActionButton>
                          </Tooltip>
                          <Tooltip content="Download" position="top" color="primary">
                            <ActionButton
                              variant="outline"
                              onClick={() => onDownloadAttachment(attachment.id, attachment.fileName)}
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
                                className="px-3 cursor-pointer"
                              >
                                <HiTrash className="w-4 h-4 text-[var(--destructive)]" />
                              </ActionButton>
                            </Tooltip>
                          )}
                        </div>
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
                  accept="
            image/jpeg,
            image/png,
            image/gif,
            image/webp,
            application/pdf,
            application/msword,
            application/vnd.openxmlformats-officedocument.wordprocessingml.document,
            application/vnd.ms-excel,
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
            text/plain,
            text/csv,
            video/mp4,
            video/webm,
            video/ogg,
            video/quicktime
          "
                />

                <div className="flex justify-end items-center w-full">
                  <ActionButton
                    onClick={handleButtonClick}
                    disabled={isUploading}
                    primary
                    showPlusIcon={!isUploading}
                  >
                    {isUploading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </div>
                    ) : (
                      <div className="text-center">Add Attachment</div>
                    )}
                  </ActionButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TaskAttachments;
