import { apiClient } from './client';

// ---- Settings ----
export async function fetchSettings() {
  const { data } = await apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/settings');
  return data.data;
}
export async function saveSettings(entries: Record<string, unknown>) {
  await apiClient.put('/settings', entries);
}

// ---- Expenses ----
export interface ExpenseCategory { id: string; name: string }
export interface Expense {
  id: string; amount: string; description: string | null; is_recurring: boolean;
  recurrence_interval: string | null; spent_at: string; category_name: string;
}
export async function fetchExpenseCategories() {
  const { data } = await apiClient.get<{ success: boolean; data: ExpenseCategory[] }>('/expenses/categories');
  return data.data;
}
export async function createExpenseCategory(name: string) {
  const { data } = await apiClient.post('/expenses/categories', { name });
  return data.data;
}
export async function fetchExpenses() {
  const { data } = await apiClient.get<{ success: boolean; data: Expense[] }>('/expenses');
  return data.data;
}
export async function createExpense(payload: {
  expenseCategoryId: string; amount: number; description?: string; isRecurring?: boolean;
  recurrenceInterval?: string; spentAt: string;
}) {
  const { data } = await apiClient.post('/expenses', payload);
  return data.data;
}
export async function deleteExpense(id: string) {
  await apiClient.delete(`/expenses/${id}`);
}

// ---- Employees ----
export interface Employee {
  id: string; full_name: string; email: string; phone: string | null; is_active: boolean;
  last_login_at: string | null; role: string;
}
export async function fetchEmployees() {
  const { data } = await apiClient.get<{ success: boolean; data: Employee[] }>('/employees');
  return data.data;
}
export async function checkInSelf() {
  await apiClient.post('/employees/attendance/check-in', {});
}
export async function checkOutSelf() {
  await apiClient.post('/employees/attendance/check-out', {});
}
export async function fetchAttendance() {
  const { data } = await apiClient.get('/employees/attendance');
  return data.data;
}

// ---- Payroll ----
export interface CurrentSalary { user_id: string; full_name: string; base_salary: string | null; effective_from: string | null }
export interface SalaryPayment { id: string; full_name: string; period_month: string; amount: string; status: string }

export async function fetchCurrentSalaries() {
  const { data } = await apiClient.get<{ success: boolean; data: CurrentSalary[] }>('/employees/salary/current');
  return data.data;
}
export async function setEmployeeSalary(userId: string, baseSalary: number, effectiveFrom: string) {
  await apiClient.post('/employees/salary', { userId, baseSalary, effectiveFrom });
}
export async function fetchSalaryPayments() {
  const { data } = await apiClient.get<{ success: boolean; data: SalaryPayment[] }>('/employees/salary/payments');
  return data.data;
}
export async function recordSalaryPayment(userId: string, periodMonth: string, amount: number) {
  await apiClient.post('/employees/salary/payments', { userId, periodMonth, amount });
}

// ---- Notifications ----
export interface AppNotification {
  id: string; type: string; title: string; message: string | null; is_read: boolean; created_at: string;
}
export async function fetchNotifications() {
  const { data } = await apiClient.get<{ success: boolean; data: AppNotification[]; unreadCount: number }>('/notifications');
  return data;
}
export async function markNotificationRead(id: string) {
  await apiClient.patch(`/notifications/${id}/read`);
}
export async function markAllNotificationsRead() {
  await apiClient.patch('/notifications/read-all');
}

// ---- CSV export ----
export async function downloadReportCsv(report: 'sales' | 'products' | 'financial', params: Record<string, string> = {}) {
  const response = await apiClient.get(`/reports/${report}`, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${report}-report.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ---- PDF export (branded report) ----
export async function downloadReportPdf(report: 'sales' | 'financial', params: Record<string, string> = {}) {
  const response = await apiClient.get(`/reports/${report}`, {
    params: { ...params, format: 'pdf' },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${report}-report.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
