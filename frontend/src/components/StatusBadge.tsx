import clsx from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-sage-400/15 text-sage-500',
  occupied: 'bg-brick-500/10 text-brick-500',
  reserved: 'bg-amber-400/15 text-amber-600',
  cleaning: 'bg-ink-faint/10 text-ink-faint',
  held: 'bg-ink-faint/10 text-ink-faint',
  placed: 'bg-amber-400/15 text-amber-600',
  preparing: 'bg-amber-400/15 text-amber-600',
  ready: 'bg-sage-400/15 text-sage-500',
  served: 'bg-brand-50 text-brand-600',
  completed: 'bg-brand-50 text-brand-600',
  cancelled: 'bg-brick-500/10 text-brick-500',
  new: 'bg-ink-faint/10 text-ink-faint',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize',
        STATUS_STYLES[status] ?? 'bg-ink-faint/10 text-ink-faint'
      )}
    >
      <span className="status-dot bg-current" />
      {status.replace('_', ' ')}
    </span>
  );
}
