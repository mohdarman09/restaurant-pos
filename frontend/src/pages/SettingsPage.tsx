import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { fetchSettings, saveSettings } from '../api/misc';

interface SettingsForm {
  restaurantName: string;
  receiptFooterText: string;
  defaultTaxPercent: string;
  currencySymbol: string;
  printerIp: string;
}

const DEFAULTS: SettingsForm = {
  restaurantName: 'Spice Junction',
  receiptFooterText: 'Thank you for dining with us — visit again!',
  defaultTaxPercent: '5',
  currencySymbol: '₹',
  printerIp: '',
};

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings().then((data) => {
      setForm({ ...DEFAULTS, ...(data as Partial<SettingsForm>) });
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    await saveSettings(form as unknown as Record<string, unknown>);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <p className="text-sm text-ink-faint">Loading settings…</p>;

  const field = (key: keyof SettingsForm, label: string, placeholder = '') => (
    <div>
      <label className="text-xs font-medium text-ink-muted uppercase tracking-wide">{label}</label>
      <input
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );

  return (
    <div className="max-w-xl space-y-5">
      <div className="ticket p-6 space-y-4">
        <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-1">Restaurant Information</p>
        {field('restaurantName', 'Restaurant Name')}
      </div>

      <div className="ticket p-6 space-y-4">
        <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-1">Tax & Currency</p>
        <div className="grid grid-cols-2 gap-4">
          {field('defaultTaxPercent', 'Default Tax %')}
          {field('currencySymbol', 'Currency Symbol')}
        </div>
      </div>

      <div className="ticket p-6 space-y-4">
        <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-1">Receipt & Printer</p>
        {field('receiptFooterText', 'Receipt Footer Text')}
        {field('printerIp', 'Receipt Printer IP', 'e.g. 192.168.1.50')}
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg"
      >
        <Save size={16} /> {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
