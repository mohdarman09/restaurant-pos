import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { fetchCategories, fetchProducts, createProduct, updateProduct, deleteProduct } from '../api/menu';
import type { Category, Product } from '../types';

export default function MenuManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', price: '', costPrice: '', isVeg: true, isAvailable: true });

  function loadProducts() {
    fetchProducts({ categoryId: activeCategory ?? undefined }).then(setProducts);
  }

  useEffect(() => {
    fetchCategories().then((cats) => {
      setCategories(cats);
      if (cats[0]) setActiveCategory(cats[0].id);
    });
  }, []);

  useEffect(() => {
    if (activeCategory) loadProducts();
  }, [activeCategory]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', price: '', costPrice: '', isVeg: true, isAvailable: true });
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, price: p.price, costPrice: p.cost_price, isVeg: p.is_veg, isAvailable: p.is_available });
    setShowForm(true);
  }

  async function handleSave() {
    if (!activeCategory) return;
    const payload = {
      name: form.name,
      price: Number(form.price),
      costPrice: Number(form.costPrice || 0),
      isVeg: form.isVeg,
      isAvailable: form.isAvailable,
      categoryId: activeCategory,
    };
    if (editing) await updateProduct(editing.id, payload);
    else await createProduct(payload);
    setShowForm(false);
    loadProducts();
  }

  async function handleDelete(id: string) {
    await deleteProduct(id);
    loadProducts();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx(
                'shrink-0 px-4 py-2 rounded-full text-sm font-medium',
                activeCategory === cat.id ? 'bg-brand-500 text-white' : 'bg-paper-card border border-ink/10 text-ink-muted'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-amber-500 text-brand-700 font-semibold text-sm px-4 py-2 rounded-lg shrink-0"
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      <div className="ticket overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink-faint text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Item</th>
              <th className="text-right px-4 py-3 font-medium">Price</th>
              <th className="text-right px-4 py-3 font-medium">Cost</th>
              <th className="text-right px-4 py-3 font-medium">Margin</th>
              <th className="text-center px-4 py-3 font-medium">Available</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const price = Number(p.price);
              const cost = Number(p.cost_price);
              const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(0) : '0';
              return (
                <tr key={p.id} className="border-t border-ink/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={clsx('w-2.5 h-2.5 rounded-sm border', p.is_veg ? 'border-sage-500' : 'border-brick-500')} />
                      {p.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">₹{price.toFixed(0)}</td>
                  <td className="px-4 py-3 text-right text-ink-faint">₹{cost.toFixed(0)}</td>
                  <td className="px-4 py-3 text-right text-sage-500 font-medium">{margin}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('inline-block w-2 h-2 rounded-full', p.is_available ? 'bg-sage-500' : 'bg-ink-faint/40')} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="text-ink-faint hover:text-brand-500">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-ink-faint hover:text-brick-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">No items in this category yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="ticket p-6 w-full max-w-sm space-y-3">
            <p className="font-display text-lg uppercase mb-1">{editing ? 'Edit Item' : 'New Menu Item'}</p>
            <input
              placeholder="Item name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Price"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
              <input
                placeholder="Cost price"
                type="number"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isVeg} onChange={(e) => setForm({ ...form, isVeg: e.target.checked })} />
                Vegetarian
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
                Available
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm border border-ink/15">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm bg-brand-500 text-white font-semibold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
