import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList, Grid3x3, ChefHat, Boxes, BarChart3, Users2,
  Wallet, UserCog, Settings,
} from 'lucide-react';
import { useAppSelector } from '../app/hooks';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'owner', 'manager'] },
  { to: '/pos', label: 'Billing', icon: UtensilsCrossed, roles: ['super_admin', 'owner', 'manager', 'cashier'] },
  { to: '/tables', label: 'Tables', icon: Grid3x3, roles: ['super_admin', 'owner', 'manager', 'waiter', 'cashier'] },
  { to: '/kds', label: 'Kitchen', icon: ChefHat, roles: ['super_admin', 'owner', 'manager', 'kitchen_staff'] },
  { to: '/orders', label: 'Orders', icon: ClipboardList, roles: ['super_admin', 'owner', 'manager', 'cashier'] },
  { to: '/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['super_admin', 'owner', 'manager'] },
  { to: '/inventory', label: 'Inventory', icon: Boxes, roles: ['super_admin', 'owner', 'manager'] },
  { to: '/customers', label: 'Customers', icon: Users2, roles: ['super_admin', 'owner', 'manager', 'cashier'] },
  { to: '/employees', label: 'Employees', icon: UserCog, roles: ['super_admin', 'owner', 'manager'] },
  { to: '/expenses', label: 'Expenses', icon: Wallet, roles: ['super_admin', 'owner', 'manager'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['super_admin', 'owner', 'manager'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'owner'] },
];

export function Sidebar() {
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';

  return (
    <aside className="w-60 shrink-0 bg-brand-700 text-paper-soft flex flex-col">
      <div className="px-5 py-5 border-b border-brand-600/60">
        <p className="font-display text-lg tracking-wide uppercase">Spice Junction</p>
        <p className="text-xs text-brand-100/70 mt-0.5">Sadar Bazaar Outlet</p>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter((item) => item.roles.includes(role)).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive ? 'bg-amber-500 text-brand-700 font-semibold' : 'text-brand-50/85 hover:bg-brand-600/70'
              )
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 text-[11px] text-brand-100/50 border-t border-brand-600/60">
        Restaurant POS v1.0
      </div>
    </aside>
  );
}
