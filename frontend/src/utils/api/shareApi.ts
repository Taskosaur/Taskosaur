import api from '@/lib/api';

export interface CreateShareDto {
  taskId: string;
  expiresInDays: number;
}

export interface ShareResponse {
  id: string;
  token: string;
  shareUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface PublicSharedTask {
  title: string;
  description?: string;
  status: { name: string; color: string };
  priority: string;
  dueDate?: string;
  assignees: Array<{ firstName: string; lastName: string }>;
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    url?: string;
  }>;
}

// Base64url regex for token validation
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

export const shareApi = {
  // Create a new share link
  createShare: async (data: CreateShareDto): Promise<ShareResponse> => {
    try {
      const response = await api.post<ShareResponse>('/task-shares', data);
      return response.data;
    } catch (error) {
      console.error('Create share error:', error);
      throw error;
    }
  },

  // Get active shares for a task
  getSharesForTask: async (taskId: string): Promise<ShareResponse[]> => {
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    try {
      const response = await api.get<ShareResponse[]>(`/task-shares/task/${encodeURIComponent(taskId)}`);
      return response.data;
    } catch (error) {
      console.error('Get shares error:', error);
      throw error;
    }
  },

  // Revoke a share link
  revokeShare: async (shareId: string): Promise<void> => {
    try {
      await api.delete(`/task-shares/${shareId}`);
    } catch (error) {
      console.error('Revoke share error:', error);
      throw error;
    }
  },

  // Get public task by token (no auth required)
  getPublicTask: async (token: string): Promise<PublicSharedTask> => {
    if (!token || !TOKEN_REGEX.test(token)) {
      throw new Error('Invalid token format');
    }
    try {
      // Create a new axios instance without interceptors for public access
      // or use the existing one if it handles public routes gracefully
      const response = await api.get<PublicSharedTask>(`/public/tasks/${encodeURIComponent(token)}`);
      return response.data;
    } catch (error) {
      console.error('Get public task error:', error);
      throw error;
    }
  },

  // Get public attachment URL
  getAttachmentUrl: async (token: string, attachmentId: string): Promise<string> => {
    if (!token || !TOKEN_REGEX.test(token)) {
      throw new Error('Invalid token format');
    }
    try {
      const response = await api.get<{ url: string }>(`/public/tasks/${encodeURIComponent(token)}/attachments/${encodeURIComponent(attachmentId)}`);
      return response.data.url;
    } catch (error) {
      console.error('Get attachment URL error:', error);
      throw error;
    }
  }
};
