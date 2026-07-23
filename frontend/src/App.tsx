import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PosPage from './pages/PosPage';
import TablesPage from './pages/TablesPage';
import KdsPage from './pages/KdsPage';
import OrdersPage from './pages/OrdersPage';
import MenuManagementPage from './pages/MenuManagementPage';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import EmployeesPage from './pages/EmployeesPage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout title="Dashboard" />}>
            <Route index element={<DashboardPage />} />
          </Route>
          <Route path="/pos" element={<DashboardLayout title="Billing" />}>
            <Route index element={<PosPage />} />
          </Route>
          <Route path="/tables" element={<DashboardLayout title="Tables" />}>
            <Route index element={<TablesPage />} />
          </Route>
          <Route path="/kds" element={<DashboardLayout title="Kitchen Display" />}>
            <Route index element={<KdsPage />} />
          </Route>
          <Route path="/orders" element={<DashboardLayout title="Orders" />}>
            <Route index element={<OrdersPage />} />
          </Route>
          <Route path="/menu" element={<DashboardLayout title="Menu Management" />}>
            <Route index element={<MenuManagementPage />} />
          </Route>
          <Route path="/inventory" element={<DashboardLayout title="Inventory" />}>
            <Route index element={<InventoryPage />} />
          </Route>
          <Route path="/customers" element={<DashboardLayout title="Customers" />}>
            <Route index element={<CustomersPage />} />
          </Route>
          <Route path="/reports" element={<DashboardLayout title="Reports" />}>
            <Route index element={<ReportsPage />} />
          </Route>
          <Route path="/employees" element={<DashboardLayout title="Employees" />}>
            <Route index element={<EmployeesPage />} />
          </Route>
          <Route path="/expenses" element={<DashboardLayout title="Expenses" />}>
            <Route index element={<ExpensesPage />} />
          </Route>
          <Route path="/settings" element={<DashboardLayout title="Settings" />}>
            <Route index element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
