import { apiClient } from './client';
import type { OrderRecord } from '../types';

export interface CreateOrderItemPayload {
  productId?: string;
  comboMealId?: string;
  quantity: number;
  addonIds?: string[];
  notes?: string;
}

export async function createOrder(payload: {
  orderType: 'dine_in' | 'take_away' | 'delivery';
  tableId?: string | null;
  customerId?: string | null;
  items: CreateOrderItemPayload[];
}) {
  const { data } = await apiClient.post<{ success: boolean; data: OrderRecord }>('/orders', payload);
  return data.data;
}

export async function applyDiscount(orderId: string, payload: { discountPercent?: number; couponCode?: string }) {
  const { data } = await apiClient.patch(`/orders/${orderId}/discount`, payload);
  return data.data;
}

export async function checkoutOrder(
  orderId: string,
  payload: { payments: { method: string; amount: number; referenceNo?: string }[]; serviceChargeId?: string | null }
) {
  const { data } = await apiClient.post(`/orders/${orderId}/checkout`, payload);
  return data.data;
}

export async function listOrders(params: { status?: string; page?: number } = {}) {
  const { data } = await apiClient.get<{ success: boolean; data: OrderRecord[] }>('/orders', { params });
  return data.data;
}

export async function getOrder(id: string) {
  const { data } = await apiClient.get(`/orders/${id}`);
  return data.data;
}

export async function cancelOrder(id: string, reason?: string) {
  await apiClient.patch(`/orders/${id}/cancel`, { reason });
}

// ---- Split bill ----
export interface OrderSplit { id: string; split_label: string; amount: string; is_paid: boolean }

export async function createSplits(orderId: string, splits: { label: string; amount: number }[]) {
  const { data } = await apiClient.post<{ success: boolean; data: OrderSplit[] }>(`/orders/${orderId}/splits`, { splits });
  return data.data;
}

export async function paySplit(orderId: string, splitId: string, method: string, referenceNo?: string) {
  const { data } = await apiClient.patch<{ success: boolean; data: { splits: OrderSplit[]; orderCompleted: boolean } }>(
    `/orders/${orderId}/splits/${splitId}/pay`,
    { method, referenceNo }
  );
  return data.data;
}

// ---- Receipt delivery ----
export async function fetchReceiptText(orderId: string) {
  const { data } = await apiClient.get<{ success: boolean; data: { text: string } }>(`/orders/${orderId}/receipt/text`);
  return data.data.text;
}

export async function emailReceipt(orderId: string, email: string) {
  const { data } = await apiClient.post(`/orders/${orderId}/receipt/email`, { email });
  return data.message as string;
}

export async function whatsappReceiptLink(orderId: string, phone: string) {
  const { data } = await apiClient.post<{ success: boolean; data: { link: string } }>(
    `/orders/${orderId}/receipt/whatsapp`,
    { phone }
  );
  return data.data.link;
}
