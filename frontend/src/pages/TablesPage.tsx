import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import clsx from 'clsx';
import { fetchTables, updateTableStatus } from '../api/operations';
import { getSocket } from '../api/socket';
import type { DiningTable } from '../types';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_CYCLE: DiningTable['status'][] = ['available', 'occupied', 'reserved', 'cleaning'];

export default function TablesPage() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetchTables().then(setTables).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('tables:update', load);
    const interval = setInterval(load, 20000); // fallback in case the socket drops
    return () => {
      socket.off('tables:update', load);
      clearInterval(interval);
    };
  }, []);

  async function cycleStatus(table: DiningTable) {
    const currentIdx = STATUS_CYCLE.indexOf(table.status);
    const next = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    await updateTableStatus(table.id, next);
    load();
  }

  if (loading) return <p className="text-sm text-ink-faint">Loading floor plan…</p>;

  return (
    <div>
      <p className="text-sm text-ink-faint mb-4">Tap a table to cycle its status — available → occupied → reserved → cleaning.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
        {tables.map((t) => (
          <button
            key={t.id}
            onClick={() => cycleStatus(t)}
            className={clsx(
              'ticket p-4 text-left border-2 transition-colors',
              t.status === 'available' && 'border-sage-400/40',
              t.status === 'occupied' && 'border-brick-500/40',
              t.status === 'reserved' && 'border-amber-400/40',
              t.status === 'cleaning' && 'border-ink-faint/20'
            )}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-xl">{t.name}</p>
              <span className="flex items-center gap-1 text-xs text-ink-faint">
                <Users size={12} /> {t.capacity}
              </span>
            </div>
            <div className="mt-2">
              <StatusBadge status={t.status} />
            </div>
            {t.active_order_total && (
              <p className="text-xs text-ink-faint mt-2">Bill: ₹{Number(t.active_order_total).toFixed(0)}</p>
            )}
          </button>
        ))}
        {tables.length === 0 && <p className="text-sm text-ink-faint">No tables configured for this outlet yet.</p>}
      </div>
    </div>
  );
}
