import api from "@/lib/api";

export interface Setting {
  key: string;
  value: string | null;
  description: string | null;
  category: string;
}

export interface SetSettingData {
  key: string;
  value: string;
  description?: string;
  category?: string;
  isEncrypted?: boolean;
}

export const settingsApi = {
  getAll: async (category?: string): Promise<Setting[]> => {
    const response = await api.get<Setting[]>("/settings", {
      params: { category },
    });
    return response.data;
  },

  getSetting: async (key: string, defaultValue?: string): Promise<string | null> => {
    const response = await api.get<{ key: string; value: string | null }>(`/settings/${key}`, {
      params: { defaultValue },
    });
    return response.data.value;
  },

  setSetting: async (settingData: SetSettingData): Promise<void> => {
    await api.post("/settings", settingData);
  },

  deleteSetting: async (key: string): Promise<void> => {
    await api.delete(`/settings/${key}`);
  },
};
