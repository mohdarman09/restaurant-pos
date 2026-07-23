import { apiClient } from './client';
import type { User } from '../types';

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<{ success: boolean; data: { accessToken: string; refreshToken: string; user: User } }>(
    '/auth/login',
    { email, password }
  );
  return data.data;
}

export async function fetchMe() {
  const { data } = await apiClient.get<{ success: boolean; data: User }>('/auth/me');
  return data.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}
