import { useEffect, useState } from 'react';
import { listOrders } from '../api/orders';
import type { OrderRecord } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  useEffect(() => {
    listOrders().then(setOrders);
  }, []);

  return (
    <div className="ticket overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper text-ink-faint text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Order #</th>
            <th className="text-left px-4 py-3 font-medium">Type</th>
            <th className="text-left px-4 py-3 font-medium">Table</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            <th className="text-center px-4 py-3 font-medium">Status</th>
            <th className="text-right px-4 py-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-ink/5">
              <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
              <td className="px-4 py-3 capitalize">{o.order_type.replace('_', ' ')}</td>
              <td className="px-4 py-3">{o.table_name ?? '—'}</td>
              <td className="px-4 py-3 text-right font-medium">₹{Number(o.total_amount).toFixed(0)}</td>
              <td className="px-4 py-3 text-center"><StatusBadge status={o.status} /></td>
              <td className="px-4 py-3 text-right text-ink-faint text-xs">
                {new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-faint">No orders yet today.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
