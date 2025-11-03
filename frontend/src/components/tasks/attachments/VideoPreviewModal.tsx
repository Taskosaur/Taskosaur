import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HiXMark } from "react-icons/hi2";
import { ArrowDownToLine } from "lucide-react";
import ActionButton from "@/components/common/ActionButton";
import Tooltip from "@/components/common/ToolTip";

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
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setVideoLoaded(false);
    }
  }, [isOpen]);

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
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[80vw] !w-[80vw] max-h-[90vh] p-0 overflow-hidden border-none gap-0"
        style={{ maxWidth: "80vw", width: "80vw" }}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-md font-semibold text-[var(--foreground)] truncate">
                {fileName}
              </DialogTitle>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {formatFileSize(fileSize)} • {formatDate(createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Tooltip content="Download Video">
                <ActionButton onClick={onDownload} secondary className="h-9 px-3">
                  <ArrowDownToLine className="w-4 h-4" />
                </ActionButton>
              </Tooltip>
              <Tooltip content="Close Preview">
                <ActionButton
                  onClick={onClose}
                  variant="outline"
                  secondary
                  className="h-9 px-3 hover:bg-accent hover:text-accent-foreground"
                >
                  <HiXMark className="w-4 h-4" />
                </ActionButton>
              </Tooltip>
            </div>
          </div>
        </DialogHeader>

        {/* Video Container */}
        <div
          className="relative flex items-center justify-center bg-[var(--background)] overflow-auto"
          style={{ height: "calc(90vh - 100px)" }}
        >
          <div className="p-8 flex items-center justify-center">
            <video
              src={videoUrl}
              controls
              onLoadedData={() => setVideoLoaded(true)}
              className="max-w-full max-h-full object-contain rounded-md shadow-md"
            >
              Your browser does not support HTML5 video.
            </video>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
