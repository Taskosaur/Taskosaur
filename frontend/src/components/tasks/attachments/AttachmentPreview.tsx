import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { useTask } from "@/contexts/task-context";
import type { Attachment, FileType, PreviewCache } from "../../../types/attachments";
import { toast } from "sonner";
import { VideoPreviewModal } from "./VideoPreviewModal";

interface AttachmentPreviewProps {
  attachment: Attachment;
  onDownload: () => void;
}

export interface AttachmentPreviewRef {
  openPreview: () => void;
  isLoading: boolean;
}

// Cache to store preview URLs
const previewCache: PreviewCache = {};

// Helper function to determine file type
const getFileType = (mimeType: string, fileName: string): FileType => {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType?.includes("word") || fileName.endsWith(".doc") || fileName.endsWith(".docx"))
    return "document";
  if (mimeType?.includes("sheet") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))
    return "spreadsheet";
  if (mimeType?.includes("text") || fileName.endsWith(".txt") || fileName.endsWith(".csv"))
    return "text";
  return "unknown";
};

export const AttachmentPreview = forwardRef<AttachmentPreviewRef, AttachmentPreviewProps>(
  ({ attachment, onDownload }, ref) => {
    const { previewFile, downloadAttachment } = useTask();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const previewUrlRef = useRef<string | null>(null);

    const fileType = getFileType(attachment.mimeType || "", attachment.fileName);
    const isImage = fileType === "image";
    const isVideo = fileType === "video";
    const canOpenInBrowser = ["pdf", "text"].includes(fileType);

    useEffect(() => {
      return () => {
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (!isModalOpen && previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewUrl(null);
        if (previewCache[attachment.id]) {
          delete previewCache[attachment.id];
        }
      }
    }, [isModalOpen, attachment.id]);

    const openFileInBrowser = async () => {
      setIsLoading(true);

      try {
        const blob = await downloadAttachment(attachment.id);
        const url = URL.createObjectURL(blob);

        // Open in new tab
        const newWindow = window.open(url, "_blank");

        if (!newWindow) {
          toast.error("Please allow popups to preview files");
        }

        // Cleanup after a delay to ensure the file opens
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (err) {
        console.error("Failed to open file:", err);
        toast.error("Failed to open file in browser");
      } finally {
        setIsLoading(false);
      }
    };
    const loadPreview = async () => {
      const cached = previewCache[attachment.id];
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setPreviewUrl(cached.url);
        setIsModalOpen(true);
        return;
      }

      setIsLoading(true);

      try {
        // Preview blob for both images and videos
        const blob = await previewFile(attachment.id);
        if (!blob) throw new Error("No preview available");

        const url = URL.createObjectURL(blob);

        previewCache[attachment.id] = { url, timestamp: Date.now() };
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setIsModalOpen(true);
      } catch (err) {
        console.error("Failed to load preview:", err);
        toast.error("Failed to load file preview"); // generic message
      } finally {
        setIsLoading(false);
      }
    };

    const handleClick = () => {
      if (isLoading) return;

      if (isImage || isVideo) {
        loadPreview();
      } else if (canOpenInBrowser) {
        openFileInBrowser();
      } else {
        // For other file types, just download
        onDownload();
      }
    };

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      openPreview: handleClick,
      isLoading,
    }));

    return (
      <>
        {isImage && previewUrl && (
          <ImagePreviewModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            imageUrl={previewUrl}
            fileName={attachment.fileName}
            fileSize={attachment.fileSize}
            createdAt={attachment.createdAt}
            onDownload={onDownload}
          />
        )}
        {isVideo && previewUrl && (
          <VideoPreviewModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            videoUrl={previewUrl}
            fileName={attachment.fileName}
            fileSize={attachment.fileSize}
            createdAt={attachment.createdAt}
            onDownload={onDownload}
          />
        )}
      </>
    );
  }
);

AttachmentPreview.displayName = "AttachmentPreview";
