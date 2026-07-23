import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface Customer {
  id: string; full_name: string; phone: string | null; email: string | null; loyalty_points: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    apiClient.get<{ success: boolean; data: Customer[] }>('/customers').then((res) => setCustomers(res.data.data));
  }, []);

  return (
    <div className="ticket overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper text-ink-faint text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Name</th>
            <th className="text-left px-4 py-3 font-medium">Phone</th>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-right px-4 py-3 font-medium">Loyalty Points</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-t border-ink/5">
              <td className="px-4 py-3">{c.full_name}</td>
              <td className="px-4 py-3 text-ink-faint">{c.phone ?? '—'}</td>
              <td className="px-4 py-3 text-ink-faint">{c.email ?? '—'}</td>
              <td className="px-4 py-3 text-right font-medium">{c.loyalty_points}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-faint">No customers yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
