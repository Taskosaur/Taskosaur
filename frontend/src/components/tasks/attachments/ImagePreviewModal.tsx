import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HiPhoto, HiXMark } from 'react-icons/hi2';
import { ArrowDownToLine, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import ActionButton from '@/components/common/ActionButton';

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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="!max-w-[80vw] !w-[80vw] max-h-[90vh] p-0 overflow-hidden"
        style={{ maxWidth: '80vw', width: '80vw' }}
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
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-4">
              <ActionButton
                onClick={handleZoomOut}
                variant="outline"
                secondary
                className="h-9 px-3"
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </ActionButton>
              
              <ActionButton
                onClick={handleZoomIn}
                variant="outline"
                secondary
                className="h-9 px-3"
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </ActionButton>
              
              <ActionButton
                onClick={handleRotate}
                variant="outline"
                secondary
                className="h-9 px-3"
              >
                <RotateCw className="w-4 h-4" />
              </ActionButton>
              
              <ActionButton
                onClick={handleReset}
                variant="outline"
                secondary
                className="h-9 px-3 text-xs"
              >
                Reset
              </ActionButton>
              
              <ActionButton
                onClick={onDownload}
                variant="outline"
                secondary
                className="h-9 px-3"
              >
                <ArrowDownToLine className="w-4 h-4" />
              </ActionButton>
            </div>
          </div>
        </DialogHeader>

        {/* Image Container */}
        <div className="relative flex items-center justify-center bg-[var(--muted)]/30 overflow-auto" style={{ height: 'calc(90vh - 100px)' }}>
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
              <p className="text-base font-medium text-[var(--foreground)] mb-2">Failed to load image</p>
              <p className="text-sm text-[var(--muted-foreground)]">The image could not be displayed</p>
            </div>
          ) : (
            <div className="p-8 flex items-center justify-center">
              <img
                src={imageUrl}
                alt={fileName}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`max-w-full max-h-full object-contain transition-all duration-200 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center',
                }}
              />
            </div>
          )}
        </div>

        {/* Zoom indicator */}
        {imageLoaded && !imageError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg">
            <p className="text-xs text-[var(--muted-foreground)]">
              {Math.round(zoom * 100)}%
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}