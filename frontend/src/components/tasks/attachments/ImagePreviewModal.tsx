import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HiPhoto, HiXMark } from "react-icons/hi2";
import { ArrowDownToLine } from "lucide-react";
import ActionButton from "@/components/common/ActionButton";
import Tooltip from "@/components/common/ToolTip";

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  onDownload: () => void;
}

export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  fileName,
  fileSize,
  createdAt,
  onDownload,
}: ImagePreviewModalProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setZoom(1);
      setRotation(0);
      setImageLoaded(false);
      setImageError(false);
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
              <Tooltip content="Download Image">
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

        {/* Image Container */}
        <div
          className="relative flex items-center justify-center bg-[var(--background)] overflow-auto"
          style={{ height: "calc(90vh - 100px)" }}
        >
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--muted-foreground)]">Loading image...</p>
              </div>
            </div>
          )}

          {imageError ? (
            <div className="flex flex-col items-center justify-center p-8">
              <HiPhoto className="w-20 h-20 text-[var(--muted-foreground)] mb-4" />
              <p className="text-base font-medium text-[var(--foreground)] mb-2">
                Failed to load image
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                The image could not be displayed
              </p>
            </div>
          ) : (
            <div className="p-8 flex items-center justify-center">
              <img
                src={imageUrl}
                alt={fileName}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`max-w-full max-h-full object-contain transition-all duration-200 ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center",
                }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
