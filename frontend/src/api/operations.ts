import { apiClient } from './client';
import type { DiningTable, KitchenTicket } from '../types';

export async function fetchTables() {
  const { data } = await apiClient.get<{ success: boolean; data: DiningTable[] }>('/tables');
  return data.data;
}

export async function updateTableStatus(id: string, status: DiningTable['status']) {
  await apiClient.patch(`/tables/${id}/status`, { status });
}

export async function fetchKitchenTickets() {
  const { data } = await apiClient.get<{ success: boolean; data: KitchenTicket[] }>('/kds/tickets');
  return data.data;
}

export async function updateKitchenItemStatus(itemId: string, status: string) {
  await apiClient.patch(`/kds/items/${itemId}/status`, { status });
}

export async function fetchSalesReport(from?: string, to?: string) {
  const { data } = await apiClient.get('/reports/sales', { params: { from, to } });
  return data.data;
}

export async function fetchProductReport(type: 'best' | 'slow' = 'best') {
  const { data } = await apiClient.get('/reports/products', { params: { type } });
  return data.data;
}

export async function fetchFinancialReport(from?: string, to?: string) {
  const { data } = await apiClient.get('/reports/financial', { params: { from, to } });
  return data.data;
}
