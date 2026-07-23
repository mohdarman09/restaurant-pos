import { Bell, LogOut, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markAllNotificationsRead, AppNotification } from '../api/misc';
import clsx from 'clsx';

export function Topbar({ title }: { title: string }) {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    function load() {
      fetchNotifications().then((res) => {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
      });
    }
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleOpenNotifications() {
    setNotifOpen((o) => !o);
    if (unreadCount > 0) {
      await markAllNotificationsRead();
      setUnreadCount(0);
    }
  }

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-ink/10 bg-paper-soft relative">
      <h1 className="font-display text-xl uppercase tracking-wide">{title}</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setDark((d) => !d)}
          className="p-2 rounded-full hover:bg-ink/5 text-ink-muted"
          title="Toggle theme (visual only in this preview)"
        >
          <Moon size={18} fill={dark ? 'currentColor' : 'none'} />
        </button>
        <div className="relative">
          <button onClick={handleOpenNotifications} className="p-2 rounded-full hover:bg-ink/5 text-ink-muted relative">
            <Bell size={18} />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brick-500" />}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 ticket p-3 z-50 max-h-96 overflow-y-auto">
              <p className="text-xs uppercase text-ink-faint font-medium px-1 mb-2">Notifications</p>
              {notifications.length === 0 && <p className="text-sm text-ink-faint px-1 py-4">You're all caught up.</p>}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={clsx('px-2 py-2 rounded-lg text-sm', !n.is_read && 'bg-amber-400/10')}
                >
                  <p className="font-medium">{n.title}</p>
                  {n.message && <p className="text-xs text-ink-faint mt-0.5">{n.message}</p>}
                  <p className="text-[11px] text-ink-faint mt-1">
                    {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pl-3 border-l border-ink/10">
          <div className="w-8 h-8 rounded-full bg-amber-500 text-brand-700 font-display font-semibold flex items-center justify-center text-sm">
            {user?.fullName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="text-sm leading-tight">
            <p className="font-medium">{user?.fullName}</p>
            <p className="text-ink-faint capitalize text-xs">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={() => {
              dispatch(logout());
              navigate('/login');
            }}
            className="ml-2 p-2 rounded-full hover:bg-brick-500/10 text-brick-500"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
