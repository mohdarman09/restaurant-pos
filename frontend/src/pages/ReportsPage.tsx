import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, Printer } from 'lucide-react';
import { fetchSalesReport, fetchProductReport, fetchFinancialReport } from '../api/operations';
import { downloadReportCsv, downloadReportPdf } from '../api/misc';

interface SalesRow { period: string; orders: string; revenue: string }
interface ProductRow { id: string; name: string; category: string; units_sold: string; revenue: string }
interface FinancialData {
  revenue: number; tax: number; totalExpenses: number; grossProfit: number;
  paymentMethodBreakdown: { method: string; total: string }[];
}

export default function ReportsPage() {
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [bestSellers, setBestSellers] = useState<ProductRow[]>([]);
  const [financial, setFinancial] = useState<FinancialData | null>(null);

  useEffect(() => {
    fetchSalesReport().then(setSales);
    fetchProductReport('best').then(setBestSellers);
    fetchFinancialReport().then(setFinancial);
  }, []);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-faint">Sales, product, and financial performance for the last 30 days.</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-ink/15 text-ink-muted"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={() => downloadReportCsv('sales')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-ink/15 text-ink-muted"
          >
            <Download size={14} /> Sales CSV
          </button>
          <button
            onClick={() => downloadReportCsv('products')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-ink/15 text-ink-muted"
          >
            <Download size={14} /> Products CSV
          </button>
          <button
            onClick={() => downloadReportCsv('financial')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-amber-500 text-brand-700 font-semibold"
          >
            <Download size={14} /> Financial CSV
          </button>
          <button
            onClick={() => downloadReportPdf('financial')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-brand-500 text-white font-semibold"
          >
            <Download size={14} /> Financial PDF
          </button>
        </div>
      </div>

      <div className="ticket p-5">
        <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-4">Sales Report — daily</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sales} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#22201911" />
            <XAxis
              dataKey="period"
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              tick={{ fontSize: 11, fill: '#8A806E' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: '#8A806E' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #22201915', fontSize: 12 }} />
            <Bar dataKey="revenue" fill="#1F4B3F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="ticket p-5">
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-4">Best Selling Products</p>
          <table className="w-full text-sm">
            <tbody>
              {bestSellers.map((p) => (
                <tr key={p.id} className="border-t border-ink/5">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-ink-faint text-xs">{p.category}</td>
                  <td className="py-2 text-right">{p.units_sold} sold</td>
                  <td className="py-2 text-right font-medium">₹{Number(p.revenue).toFixed(0)}</td>
                </tr>
              ))}
              {bestSellers.length === 0 && (
                <tr><td className="py-6 text-ink-faint text-center" colSpan={4}>No sales data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ticket p-5">
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted mb-4">Financial Summary (30d)</p>
          {financial ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Revenue</span><span className="font-medium">₹{financial.revenue.toFixed(0)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Tax collected</span><span className="font-medium">₹{financial.tax.toFixed(0)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Expenses</span><span className="font-medium">₹{financial.totalExpenses.toFixed(0)}</span></div>
              <div className="flex justify-between pt-2 border-t border-ink/10 font-display text-base">
                <span>Gross Profit</span><span>₹{financial.grossProfit.toFixed(0)}</span>
              </div>
              <div className="pt-3">
                <p className="text-xs uppercase text-ink-faint mb-2">Payment Methods</p>
                {financial.paymentMethodBreakdown.map((pm) => (
                  <div key={pm.method} className="flex justify-between text-xs py-0.5 capitalize">
                    <span>{pm.method}</span><span>₹{Number(pm.total).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">Loading…</p>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-faint">
        Additional reports (order summary, cancellations, wastage, customer retention, employee performance)
        are available via the same `/api/reports/*` endpoints and can be wired into this page's export/print/date-filter controls.
      </p>
    </div>
  );
}
