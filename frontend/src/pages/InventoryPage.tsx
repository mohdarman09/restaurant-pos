import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import clsx from 'clsx';

interface RawMaterial {
  id: string; name: string; current_stock: string; reorder_level: string; unit: string; is_low_stock: boolean;
}

export default function InventoryPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);

  useEffect(() => {
    apiClient.get<{ success: boolean; data: RawMaterial[] }>('/inventory/raw-materials').then((res) => setMaterials(res.data.data));
  }, []);

  return (
    <div className="ticket overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper text-ink-faint text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Raw Material</th>
            <th className="text-right px-4 py-3 font-medium">Current Stock</th>
            <th className="text-right px-4 py-3 font-medium">Reorder Level</th>
            <th className="text-center px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.id} className="border-t border-ink/5">
              <td className="px-4 py-3">{m.name}</td>
              <td className="px-4 py-3 text-right">{Number(m.current_stock).toFixed(2)} {m.unit}</td>
              <td className="px-4 py-3 text-right text-ink-faint">{Number(m.reorder_level).toFixed(2)} {m.unit}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={clsx(
                    'inline-block px-2.5 py-1 rounded-full text-xs font-medium',
                    m.is_low_stock ? 'bg-brick-500/10 text-brick-500' : 'bg-sage-400/15 text-sage-500'
                  )}
                >
                  {m.is_low_stock ? 'Low Stock' : 'In Stock'}
                </span>
              </td>
            </tr>
          ))}
          {materials.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-faint">No raw materials tracked yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
