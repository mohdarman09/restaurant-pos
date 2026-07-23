import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  fetchExpenseCategories, createExpenseCategory, fetchExpenses, createExpense, deleteExpense,
  ExpenseCategory, Expense,
} from '../api/misc';

export default function ExpensesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [form, setForm] = useState({
    expenseCategoryId: '', amount: '', description: '', isRecurring: false,
    recurrenceInterval: 'monthly', spentAt: new Date().toISOString().slice(0, 10),
  });

  function load() {
    fetchExpenseCategories().then((cats) => {
      setCategories(cats);
      setForm((f) => ({ ...f, expenseCategoryId: f.expenseCategoryId || cats[0]?.id || '' }));
    });
    fetchExpenses().then(setExpenses);
  }

  useEffect(load, []);

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    await createExpenseCategory(newCategoryName.trim());
    setNewCategoryName('');
    load();
  }

  async function handleSave() {
    await createExpense({
      expenseCategoryId: form.expenseCategoryId,
      amount: Number(form.amount),
      description: form.description || undefined,
      isRecurring: form.isRecurring,
      recurrenceInterval: form.isRecurring ? form.recurrenceInterval : undefined,
      spentAt: form.spentAt,
    });
    setShowForm(false);
    setForm({ ...form, amount: '', description: '' });
    load();
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-faint">
          Total logged: <span className="font-semibold text-ink">₹{total.toFixed(0)}</span>
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-amber-500 text-brand-700 font-semibold text-sm px-4 py-2 rounded-lg"
        >
          <Plus size={16} /> Log Expense
        </button>
      </div>

      <div className="ticket overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink-faint text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-center px-4 py-3 font-medium">Recurring</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t border-ink/5">
                <td className="px-4 py-3 text-ink-faint text-xs">{new Date(e.spent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td className="px-4 py-3">{e.category_name}</td>
                <td className="px-4 py-3 text-ink-faint">{e.description ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium">₹{Number(e.amount).toFixed(0)}</td>
                <td className="px-4 py-3 text-center text-xs capitalize text-ink-faint">
                  {e.is_recurring ? e.recurrence_interval : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteExpense(e.id).then(load)} className="text-ink-faint hover:text-brick-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-faint">No expenses logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="ticket p-6 w-full max-w-sm space-y-3">
            <p className="font-display text-lg uppercase mb-1">Log Expense</p>

            <div className="flex gap-2">
              <select
                value={form.expenseCategoryId}
                onChange={(e) => setForm({ ...form, expenseCategoryId: e.target.value })}
                className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                placeholder="New category…"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
              <button onClick={handleAddCategory} className="px-3 rounded-lg border border-ink/15 text-sm text-ink-muted">Add</button>
            </div>

            <input
              placeholder="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            <input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={form.spentAt}
              onChange={(e) => setForm({ ...form, spentAt: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              />
              Recurring
            </label>
            {form.isRecurring && (
              <select
                value={form.recurrenceInterval}
                onChange={(e) => setForm({ ...form, recurrenceInterval: e.target.value })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm border border-ink/15">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm bg-brand-500 text-white font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
