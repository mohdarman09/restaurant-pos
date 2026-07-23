import { apiClient } from './client';
import type { DashboardSummary, SalesTrendPoint } from '../types';

export async function fetchDashboardSummary() {
  const { data } = await apiClient.get<{ success: boolean; data: DashboardSummary }>('/dashboard/summary');
  return data.data;
}

export async function fetchSalesTrend(days = 14) {
  const { data } = await apiClient.get<{ success: boolean; data: SalesTrendPoint[] }>('/dashboard/sales-trend', {
    params: { days },
  });
  return data.data;
}
