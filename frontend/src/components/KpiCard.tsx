import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'brand' | 'amber' | 'brick' | 'sage';
  sub?: string;
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-400/15 text-amber-600',
  brick: 'bg-brick-500/10 text-brick-500',
  sage: 'bg-sage-400/15 text-sage-500',
};

export function KpiCard({ label, value, icon: Icon, tone = 'brand', sub }: KpiCardProps) {
  return (
    <div className="ticket p-4 pt-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint font-medium">{label}</p>
          <p className="font-display text-2xl mt-1">{value}</p>
          {sub && <p className="text-xs text-ink-faint mt-1">{sub}</p>}
        </div>
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', TONE_CLASSES[tone])}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
