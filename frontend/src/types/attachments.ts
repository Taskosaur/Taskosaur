export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  mimeType?: string;
  url?: string;
  filePath: string;
  createdBy: string;
}

export type FileType = "image" | "pdf" | "document" | "spreadsheet" | "text" | "video" | "unknown";

export interface PreviewCache {
  [attachmentId: string]: {
    url: string;
    timestamp: number;
  };
}
