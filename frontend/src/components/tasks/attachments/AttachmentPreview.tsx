import React, { useState, useEffect, useRef } from 'react';
import { ImagePreviewModal } from './ImagePreviewModal';
import { useTask } from '@/contexts/task-context';
import type { Attachment, FileType, PreviewCache } from '../../../types/attachments';
import { toast } from 'sonner';

interface AttachmentPreviewProps {
  attachment: Attachment;
  children: React.ReactNode;
  onDownload: () => void;
}

// Cache to store preview URLs
const previewCache: PreviewCache = {};

// Helper function to determine file type
const getFileType = (mimeType: string, fileName: string): FileType => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType?.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) 
    return 'document';
  if (mimeType?.includes('sheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) 
    return 'spreadsheet';
  if (mimeType?.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.csv')) 
    return 'text';
  return 'unknown';
};

export function AttachmentPreview({ attachment, children, onDownload }: AttachmentPreviewProps) {
  const { previewFile, downloadAttachment } = useTask();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const previewUrlRef = useRef<string | null>(null);

  const fileType = getFileType(attachment.mimeType || '', attachment.fileName);
  const isImage = fileType === 'image';
  const canOpenInBrowser = ['pdf', 'text'].includes(fileType);

 
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const loadImagePreview = async () => {
    const cached = previewCache[attachment.id];
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { 
      setPreviewUrl(cached.url);
      setIsModalOpen(true);
      return;
    }

    setIsLoading(true);

    try {
      const blob = await previewFile(attachment.id);
      const url = URL.createObjectURL(blob);
      
      // Store in cache
      previewCache[attachment.id] = {
        url,
        timestamp: Date.now(),
      };
      
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to load preview:', err);
      toast.error('Failed to load image preview');
    } finally {
      setIsLoading(false);
    }
  };

  const openFileInBrowser = async () => {
    setIsLoading(true);
    
    try {
      const blob = await downloadAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      
      // Open in new tab
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow) {
        toast.error('Please allow popups to preview files');
      }
      
      // Cleanup after a delay to ensure the file opens
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error('Failed to open file:', err);
      toast.error('Failed to open file in browser');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    if (isImage) {
      loadImagePreview();
    } else if (canOpenInBrowser) {
      openFileInBrowser();
    } else {
      // For other file types, just download
      onDownload();
    }
  };

  return (
    <>
      <div onClick={handleClick} className="cursor-pointer">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            {children}
          </div>
        ) : (
          children
        )}
      </div>

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
    </>
  );
}