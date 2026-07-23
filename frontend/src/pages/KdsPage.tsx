import { useEffect, useState } from 'react';
import { Clock, Flame } from 'lucide-react';
import clsx from 'clsx';
import { fetchKitchenTickets, updateKitchenItemStatus } from '../api/operations';
import { getSocket } from '../api/socket';
import type { KitchenTicket } from '../types';

const NEXT_STATUS: Record<string, string> = { new: 'preparing', preparing: 'ready', ready: 'served' };
const STATUS_LABEL: Record<string, string> = { new: 'Start', preparing: 'Mark Ready', ready: 'Serve', served: 'Served' };

function minutesAgo(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function KdsPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);

  function load() {
    fetchKitchenTickets().then(setTickets);
  }

  useEffect(() => {
    load();
    // Live push via WebSocket — instant refresh whenever any device changes a ticket
    const socket = getSocket();
    socket.on('kds:update', load);
    // Slow fallback poll in case the socket connection drops, and to refresh the "Xm ago" timers
    const interval = setInterval(load, 15000);
    return () => {
      socket.off('kds:update', load);
      clearInterval(interval);
    };
  }, []);

  async function advance(itemId: string, currentStatus: string) {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    await updateKitchenItemStatus(itemId, next);
    load();
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {tickets.map((ticket) => {
        const age = minutesAgo(ticket.created_at);
        return (
          <div key={ticket.order_id} className="ticket p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-sm font-semibold">{ticket.order_number}</p>
              {ticket.is_priority && (
                <span className="flex items-center gap-1 text-xs text-brick-500 font-medium">
                  <Flame size={12} /> Priority
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-ink-faint mb-3">
              <span className="capitalize">{ticket.order_type.replace('_', ' ')}{ticket.table_name ? ` · ${ticket.table_name}` : ''}</span>
              <span className={clsx('flex items-center gap-1', age > 15 && 'text-brick-500 font-medium')}>
                <Clock size={12} /> {age}m
              </span>
            </div>

            <ul className="space-y-2 flex-1">
              {ticket.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 border-b border-dashed border-ink/10 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.quantity}× {item.productName}</p>
                    {item.notes && <p className="text-xs text-ink-faint truncate">{item.notes}</p>}
                  </div>
                  <button
                    onClick={() => advance(item.id, item.kitchenStatus)}
                    disabled={item.kitchenStatus === 'served'}
                    className={clsx(
                      'shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md',
                      item.kitchenStatus === 'served' ? 'bg-brand-50 text-brand-600' : 'bg-amber-500 text-brand-700'
                    )}
                  >
                    {STATUS_LABEL[item.kitchenStatus]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {tickets.length === 0 && <p className="text-sm text-ink-faint">No active kitchen tickets right now.</p>}
    </div>
  );
}
