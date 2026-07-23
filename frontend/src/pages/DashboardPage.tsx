import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { IndianRupee, ShoppingBag, Users, TrendingUp, AlertTriangle, Flame } from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { fetchDashboardSummary, fetchSalesTrend } from '../api/dashboard';
import type { DashboardSummary, SalesTrendPoint } from '../types';

function formatCurrency(value: string | number) {
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<SalesTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboardSummary(), fetchSalesTrend(14)])
      .then(([s, t]) => {
        setSummary(s);
        setTrend(t);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-ink-faint text-sm">Loading dashboard…</p>;
  }
  if (!summary) {
    return <p className="text-brick-500 text-sm">Could not load dashboard data.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Sales Today" value={formatCurrency(summary.sales_today)} icon={IndianRupee} tone="brand" />
        <KpiCard label="Sales This Week" value={formatCurrency(summary.sales_week)} icon={TrendingUp} tone="sage" />
        <KpiCard label="Sales This Month" value={formatCurrency(summary.sales_month)} icon={TrendingUp} tone="amber" />
        <KpiCard label="Avg. Order Value" value={formatCurrency(summary.avg_order_value)} icon={ShoppingBag} tone="brand" />
        <KpiCard label="Orders Today" value={summary.total_orders_today} icon={ShoppingBag} tone="brand"
          sub={`${summary.completed_orders} completed`} />
        <KpiCard label="Pending Orders" value={summary.pending_orders} icon={Flame} tone="amber" />
        <KpiCard label="Cancelled Orders" value={summary.cancelled_orders} icon={AlertTriangle} tone="brick" />
        <KpiCard label="Total Customers" value={summary.total_customers} icon={Users} tone="sage" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ticket p-5 lg:col-span-2">
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-4">Revenue — last 14 days</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1F4B3F" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1F4B3F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#22201911" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                tick={{ fontSize: 11, fill: '#8A806E' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#8A806E' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                contentStyle={{ borderRadius: 10, border: '1px solid #22201915', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#1F4B3F" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="ticket p-5">
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-4">Best Sellers (30d)</p>
          <ul className="space-y-3">
            {summary.best_selling_items.length === 0 && (
              <p className="text-sm text-ink-faint">No completed orders yet.</p>
            )}
            {summary.best_selling_items.map((item, idx) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-ink-faint w-4">{idx + 1}</span>
                  <span className="truncate">{item.name}</span>
                </div>
                <span className="text-ink-faint text-xs shrink-0">{item.units_sold} sold</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ticket p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-brick-500" />
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted">Low Stock Alerts</p>
        </div>
        {summary.low_stock_alerts.length === 0 ? (
          <p className="text-sm text-ink-faint">All raw materials are above their reorder level.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summary.low_stock_alerts.map((item) => (
              <div key={item.id} className="rounded-lg border border-brick-500/20 bg-brick-500/5 px-3 py-2">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-ink-faint">
                  {item.current_stock} left · reorder at {item.reorder_level}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
