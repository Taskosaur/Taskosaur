import api from "@/lib/api";
import { UpdateUserData, User } from "@/types";

export interface UpdateEmailData {
  email: string;
}

export const userApi = {
  getAllUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>("/users");
    return response.data;
  },

  getUserById: async (userId: string): Promise<User> => {
    const response = await api.get<User>(`/users/${userId}`);
    return response.data;
  },

  updateUser: async (userId: string, userData: UpdateUserData): Promise<User> => {
    const response = await api.patch<User>(`/users/${userId}`, userData);

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (currentUser.id === userId) {
      const updatedUser = { ...currentUser, ...response.data };
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }

    return response.data;
  },

  updateUserEmail: async (userId: string, emailData: UpdateEmailData): Promise<User> => {
    const response = await api.patch<User>(`/users/${userId}`, emailData);

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (currentUser.id === userId) {
      const updatedUser = { ...currentUser, ...response.data };
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }

    return response.data;
  },

  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/users/${userId}`);

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (currentUser.id === userId) {
      localStorage.removeItem("user");
      localStorage.removeItem("currentOrganizationId");
    }
  },
};
