import api from "@/lib/api";
import { ChartDataResponse, ChartType } from "@/types";

// Chart type enum matching backend

export const orgChartsApi = {
  /**
   * Get multiple chart data types in a single request
   */
  getMultipleCharts: async (orgId: string, chartTypes: ChartType[]): Promise<ChartDataResponse> => {
    try {
      const params = new URLSearchParams();
      chartTypes.forEach((type) => params.append("types", type));

      const response = await api.get(`/organizations/${orgId}/charts?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Get multiple charts error:", error);
      throw error;
    }
  },

  /**
   * Get single chart data type
   */
  getSingleChart: async (orgId: string, chartType: ChartType): Promise<any> => {
    try {
      const response = await api.get(`/organizations/${orgId}/charts?types=${chartType}`);
      return response.data[chartType];
    } catch (error) {
      console.error(`Get ${chartType} chart error:`, error);
      throw error;
    }
  },

  /**
   * Get all available charts
   */
  getAllCharts: async (orgId: string): Promise<ChartDataResponse> => {
    try {
      const allChartTypes = Object.values(ChartType);
      return await orgChartsApi.getMultipleCharts(orgId, allChartTypes);
    } catch (error) {
      console.error("Get all charts error:", error);
      throw error;
    }
  },
};
