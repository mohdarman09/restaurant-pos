import { apiClient } from './client';
import type { Category, Product } from '../types';

export async function fetchCategories() {
  const { data } = await apiClient.get<{ success: boolean; data: Category[] }>('/menu/categories');
  return data.data;
}

export async function fetchProducts(params: { search?: string; categoryId?: string; page?: number } = {}) {
  const { data } = await apiClient.get<{ success: boolean; data: Product[]; pagination: unknown }>('/menu/products', {
    params: { ...params, limit: 100 },
  });
  return data.data;
}

export async function createProduct(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/menu/products', payload);
  return data.data;
}

export async function updateProduct(id: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/menu/products/${id}`, payload);
  return data.data;
}

export async function deleteProduct(id: string) {
  await apiClient.delete(`/menu/products/${id}`);
}

export async function fetchProductAddons(productId: string) {
  const { data } = await apiClient.get<{
    success: boolean;
    data: { id: string; name: string; min_select: number; max_select: number; options: { id: string; name: string; price: string }[] }[];
  }>(`/menu/products/${productId}/addons`);
  return data.data;
}

export async function createCategory(payload: { name: string; sortOrder?: number }) {
  const { data } = await apiClient.post('/menu/categories', payload);
  return data.data;
}

// ---- Combo meals ----
export interface ComboMeal {
  id: string; name: string; price: string; image_url: string | null;
  items: { name: string; quantity: string; base_price: string }[];
}

export async function fetchCombos() {
  const { data } = await apiClient.get<{ success: boolean; data: ComboMeal[] }>('/menu/combos');
  return data.data;
}

export async function createCombo(payload: {
  name: string; price: number; imageUrl?: string; items: { productId: string; quantity: number }[];
}) {
  const { data } = await apiClient.post('/menu/combos', payload);
  return data.data;
}

// ---- Barcode lookup (hardware scanner support) ----
export async function findProductByBarcode(code: string) {
  const { data } = await apiClient.get<{ success: boolean; data: Product }>(`/menu/products/barcode/${encodeURIComponent(code)}`);
  return data.data;
}
