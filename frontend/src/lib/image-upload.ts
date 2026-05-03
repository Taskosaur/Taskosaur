import { toast } from "sonner";
import api from "./api";

// Configuration
const IMAGE_UPLOAD_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"] as const,
  allowedExtensions: ["jpg", "jpeg", "png", "gif", "webp"],
  uploadEndpoint: "/editor-images/upload",
} as const;

// Upload response interface
export interface ImageUploadResponse {
  message: string;
  id: string | null;  // MediaAsset ID (UUID)
  url: string | null;
  key: string;
  size: number;
  inCloud: boolean;
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!IMAGE_UPLOAD_CONFIG.allowedTypes.includes(file.type as any)) {
    const allowedExts = IMAGE_UPLOAD_CONFIG.allowedExtensions.join(", ").toUpperCase();
    return {
      valid: false,
      error: `Invalid file type. Only ${allowedExts} images are allowed.`,
    };
  }

  // Check file size
  if (file.size > IMAGE_UPLOAD_CONFIG.maxFileSize) {
    const maxSizeMB = IMAGE_UPLOAD_CONFIG.maxFileSize / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit.`,
    };
  }

  return { valid: true };
}

/**
 * Upload image file to backend
 * Returns the image URL or storage key for use in editor
 */
export async function uploadImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImageUploadResponse> {
  // Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create form data
  const formData = new FormData();
  formData.append("file", file);

  try {
    // Upload file
    const response = await api.post<ImageUploadResponse>(IMAGE_UPLOAD_CONFIG.uploadEndpoint, formData, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  } catch (error: any) {
    // Handle upload errors
    const message = error.response?.data?.message || error.message || "Upload failed";
    throw new Error(message);
  }
}

/**
 * Get the correct image URL from upload response
 * For S3 storage with presigned URL, returns the presigned URL directly
 * For S3 storage without presigned URL, returns the backend endpoint URL
 * For local storage, returns the full URL via uploads endpoint
 */
export function getImageUrl(response: ImageUploadResponse): string {
  // Get the backend API base URL (e.g., http://localhost:3000/api)
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

  // For S3 storage with presigned URL (url contains amazonaws.com or presigned query params)
  if (response.url && (response.url.includes('amazonaws.com') || response.url.includes('X-Amz-'))) {
    // Return presigned URL directly - no modification needed
    return response.url;
  }

  // For S3 storage without presigned URL (url is null), use backend streaming endpoint
  if (!response.url) {
    // Key is like "editor-images/uuid-timestamp.png"
    // Extract just the filename part after the folder
    const filename = response.key.split('/').pop();
    return `${apiBaseUrl}/uploads/editor-images/${filename}`;
  }

  // For local storage, url is relative path like "/editor-images/uuid-timestamp.png"
  // Remove leading slash if present: "/editor-images/..." -> "editor-images/..."
  const cleanUrl = response.url.startsWith('/') ? response.url.substring(1) : response.url;

  // Construct full URL to backend
  return `${apiBaseUrl}/uploads/${cleanUrl}`;
}

/**
 * Show upload success toast
 */
export function showUploadSuccessToast(filename: string): void {
  toast.success("Image uploaded successfully", {
    description: filename,
    duration: 2000,
  });
}

/**
 * Show upload error toast
 */
export function showUploadErrorToast(message: string): void {
  toast.error("Upload failed", {
    description: message,
    duration: 5000,
  });
}

/**
 * Handle image upload with toast notifications
 * Returns image URL on success, null on failure
 */
export async function handleImageUpload(
  file: File,
  options?: {
    onProgress?: (progress: number) => void;
    showToasts?: boolean;
  }
): Promise<string | null> {
  const { onProgress, showToasts = true } = options || {};

  try {
    const response = await uploadImage(file, onProgress);
    const imageUrl = getImageUrl(response);

    if (showToasts) {
      showUploadSuccessToast(file.name);
    }

    return imageUrl;
  } catch (error: any) {
    if (showToasts) {
      showUploadErrorToast(error.message);
    }
    console.error("Image upload error:", error);
    return null;
  }
}

/**
 * Generate unique placeholder ID for uploading images
 */
export function generateUploadPlaceholderId(): string {
  return `uploading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a markdown image src is an uploading placeholder
 */
export function isUploadingPlaceholder(src: string): boolean {
  return src.startsWith("uploading:");
}

/**
 * Extract placeholder ID from uploading placeholder
 */
export function extractPlaceholderId(src: string): string | null {
  if (!isUploadingPlaceholder(src)) {
    return null;
  }
  return src.replace("uploading:", "");
}

export { IMAGE_UPLOAD_CONFIG };
