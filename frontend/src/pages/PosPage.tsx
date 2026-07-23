import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Minus, Trash2, Receipt, UtensilsCrossed, ShoppingBag, Bike, Users, Printer, Mail, MessageCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  addItem, addComboItem, incrementItem, decrementItem, removeItem, setOrderType, setTable,
  setDiscountPercent, clearCart, OrderType,
} from '../features/pos/posSlice';
import { fetchCategories, fetchProducts, fetchProductAddons, fetchCombos, findProductByBarcode } from '../api/menu';
import { fetchTables } from '../api/operations';
import {
  createOrder, applyDiscount as applyDiscountApi, checkoutOrder, createSplits, paySplit,
  fetchReceiptText, emailReceipt, whatsappReceiptLink, OrderSplit,
} from '../api/orders';
import type { Category, Product, DiningTable, SelectedAddon } from '../types';
import type { ComboMeal } from '../api/menu';

const ORDER_TYPES: { value: OrderType; label: string; icon: typeof UtensilsCrossed }[] = [
  { value: 'dine_in', label: 'Dine In', icon: UtensilsCrossed },
  { value: 'take_away', label: 'Take Away', icon: ShoppingBag },
  { value: 'delivery', label: 'Delivery', icon: Bike },
];

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'wallet'] as const;
const COMBOS_TAB = '__combos__';

interface AddonGroup {
  id: string; name: string; min_select: number; max_select: number;
  options: { id: string; name: string; price: string }[];
}

export default function PosPage() {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.pos);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<ComboMeal[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [search, setSearch] = useState('');
  const [placing, setPlacing] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<(typeof PAYMENT_METHODS)[number]>('cash');
  const [lastReceipt, setLastReceipt] = useState<{ orderId: string; orderNumber: string; total: string } | null>(null);
  const [receiptBusy, setReceiptBusy] = useState<'email' | 'whatsapp' | 'print' | null>(null);

  // Addon picker modal state
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());

  // Split bill state
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [activeSplitOrderId, setActiveSplitOrderId] = useState<string | null>(null);
  const [splits, setSplits] = useState<OrderSplit[] | null>(null);
  const [splitBusy, setSplitBusy] = useState(false);

  useEffect(() => {
    fetchCategories().then((cats) => {
      setCategories(cats);
      if (cats[0]) setActiveCategory(cats[0].id);
    });
    fetchTables().then(setTables);
    fetchCombos().then(setCombos);
  }, []);

  useEffect(() => {
    if (activeCategory === COMBOS_TAB) return;
    fetchProducts({ categoryId: activeCategory || undefined, search: search || undefined }).then(setProducts);
  }, [activeCategory, search]);

  const subtotal = useMemo(
    () => cart.items.reduce((sum, i) => sum + (i.price + i.addons.reduce((a, ad) => a + ad.price, 0)) * i.quantity, 0),
    [cart.items]
  );
  const taxTotal = useMemo(
    () => cart.items.reduce(
      (sum, i) => sum + ((i.price + i.addons.reduce((a, ad) => a + ad.price, 0)) * i.quantity * i.taxRate) / 100,
      0
    ),
    [cart.items]
  );
  const discountAmount = (subtotal * cart.discountPercent) / 100;
  const grandTotal = Math.round(subtotal - discountAmount + taxTotal);

  async function handleProductTap(p: Product) {
    const groups = await fetchProductAddons(p.id);
    if (groups.length === 0) {
      dispatch(addItem({ productId: p.id, name: p.name, price: Number(p.price), taxRate: Number(p.tax_rate ?? 0) }));
      return;
    }
    setAddonProduct(p);
    setAddonGroups(groups);
    setSelectedAddonIds(new Set());
  }

  function handleComboTap(combo: ComboMeal) {
    dispatch(addComboItem({ comboMealId: combo.id, name: combo.name, price: Number(combo.price) }));
  }

  /** Hardware barcode scanners "type" the code then send Enter — try an exact match first. */
  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !search.trim()) return;
    try {
      const product = await findProductByBarcode(search.trim());
      dispatch(addItem({ productId: product.id, name: product.name, price: Number(product.price), taxRate: Number(product.tax_rate ?? 0) }));
      setSearch('');
    } catch {
      // no exact barcode match — leave it as a normal text search
    }
  }

  function toggleAddon(group: AddonGroup, optionId: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      const groupOptionIds = new Set(group.options.map((o) => o.id));
      const alreadySelectedInGroup = [...next].filter((id) => groupOptionIds.has(id));

      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        if (group.max_select === 1) {
          alreadySelectedInGroup.forEach((id) => next.delete(id));
        } else if (alreadySelectedInGroup.length >= group.max_select) {
          return prev;
        }
        next.add(optionId);
      }
      return next;
    });
  }

  function confirmAddonSelection() {
    if (!addonProduct) return;
    const chosen: SelectedAddon[] = addonGroups
      .flatMap((g) => g.options)
      .filter((o) => selectedAddonIds.has(o.id))
      .map((o) => ({ id: o.id, name: o.name, price: Number(o.price) }));

    dispatch(addItem({
      productId: addonProduct.id,
      name: addonProduct.name,
      price: Number(addonProduct.price),
      taxRate: Number(addonProduct.tax_rate ?? 0),
      addons: chosen,
    }));
    setAddonProduct(null);
  }

  function cartToOrderItems() {
    return cart.items.map((i) => ({
      productId: i.productId,
      comboMealId: i.comboMealId,
      quantity: i.quantity,
      addonIds: i.addons.map((a) => a.id),
    }));
  }

  async function createAndDiscountOrder() {
    const order = await createOrder({
      orderType: cart.orderType,
      tableId: cart.orderType === 'dine_in' ? cart.tableId : null,
      items: cartToOrderItems(),
    });
    if (cart.discountPercent > 0) {
      const updated = await applyDiscountApi(order.id, { discountPercent: cart.discountPercent });
      return updated;
    }
    return order;
  }

  async function handlePlaceAndPay() {
    if (cart.items.length === 0) return;
    setPlacing(true);
    try {
      const order = await createAndDiscountOrder();
      const completed = await checkoutOrder(order.id, {
        payments: [{ method: payMethod, amount: grandTotal }],
      });

      setLastReceipt({ orderId: completed.id, orderNumber: completed.order_number, total: completed.total_amount });
      dispatch(clearCart());
      setCheckoutOpen(false);
      fetchTables().then(setTables);
    } finally {
      setPlacing(false);
    }
  }

  async function openSplitBill() {
    if (cart.items.length === 0) return;
    setSplitBusy(true);
    try {
      const order = await createAndDiscountOrder();
      setActiveSplitOrderId(order.id);
      const equalShare = Math.floor(Number(order.total_amount) / splitCount);
      const remainder = Number(order.total_amount) - equalShare * splitCount;
      const created = await createSplits(
        order.id,
        Array.from({ length: splitCount }, (_, idx) => ({
          label: `Guest ${idx + 1}`,
          amount: idx === splitCount - 1 ? equalShare + remainder : equalShare,
        }))
      );
      setSplits(created);
      setSplitOpen(true);
    } finally {
      setSplitBusy(false);
    }
  }

  async function handlePaySplit(split: OrderSplit, method: string) {
    if (!activeSplitOrderId) return;
    setSplitBusy(true);
    try {
      const result = await paySplit(activeSplitOrderId, split.id, method);
      setSplits(result.splits);
      if (result.orderCompleted) {
        setLastReceipt({ orderId: activeSplitOrderId, orderNumber: '', total: '' });
        dispatch(clearCart());
        setSplitOpen(false);
        setActiveSplitOrderId(null);
        fetchTables().then(setTables);
      }
    } finally {
      setSplitBusy(false);
    }
  }

  async function handlePrint() {
    if (!lastReceipt) return;
    setReceiptBusy('print');
    try {
      const text = await fetchReceiptText(lastReceipt.orderId);
      const win = window.open('', '_blank', 'width=380,height=600');
      if (win) {
        win.document.write(`<pre style="font-family: monospace; font-size: 13px; padding: 16px;">${text}</pre>`);
        win.document.close();
        win.print();
      }
    } finally {
      setReceiptBusy(null);
    }
  }

  async function handleEmailReceipt() {
    if (!lastReceipt) return;
    const email = window.prompt("Customer's email address:");
    if (!email) return;
    setReceiptBusy('email');
    try {
      await emailReceipt(lastReceipt.orderId, email);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      window.alert(message ?? 'Could not send email receipt.');
    } finally {
      setReceiptBusy(null);
    }
  }

  async function handleWhatsappReceipt() {
    if (!lastReceipt) return;
    const phone = window.prompt("Customer's WhatsApp number (with country code):");
    if (!phone) return;
    setReceiptBusy('whatsapp');
    try {
      const link = await whatsappReceiptLink(lastReceipt.orderId, phone);
      window.open(link, '_blank');
    } finally {
      setReceiptBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 h-full">
      {/* Left: menu browser */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search products or scan barcode…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ink/15 text-sm bg-paper-card focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx(
                'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                activeCategory === cat.id ? 'bg-brand-500 text-white' : 'bg-paper-card border border-ink/10 text-ink-muted'
              )}
            >
              {cat.name}
            </button>
          ))}
          {combos.length > 0 && (
            <button
              onClick={() => setActiveCategory(COMBOS_TAB)}
              className={clsx(
                'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                activeCategory === COMBOS_TAB ? 'bg-amber-500 text-brand-700' : 'bg-paper-card border border-ink/10 text-ink-muted'
              )}
            >
              Combos
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3 overflow-y-auto pb-4">
          {activeCategory === COMBOS_TAB ? (
            combos.map((combo) => (
              <button
                key={combo.id}
                onClick={() => handleComboTap(combo)}
                className="ticket p-3 text-left hover:-translate-y-0.5 transition-transform border-2 border-amber-400/40"
              >
                <p className="text-sm font-medium line-clamp-2">{combo.name}</p>
                <p className="text-xs text-ink-faint mt-1 line-clamp-2">
                  {combo.items.map((i) => i.name).join(' + ')}
                </p>
                <p className="font-display text-base mt-1">₹{Number(combo.price).toFixed(0)}</p>
              </button>
            ))
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProductTap(p)}
                className="ticket p-3 text-left hover:-translate-y-0.5 transition-transform"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={clsx(
                      'w-3 h-3 rounded-sm border-2 mt-0.5 flex items-center justify-center shrink-0',
                      p.is_veg ? 'border-sage-500' : 'border-brick-500'
                    )}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full', p.is_veg ? 'bg-sage-500' : 'bg-brick-500')} />
                  </span>
                </div>
                <p className="text-sm font-medium mt-2 line-clamp-2">{p.name}</p>
                <p className="font-display text-base mt-1">₹{Number(p.price).toFixed(0)}</p>
              </button>
            ))
          )}
          {activeCategory !== COMBOS_TAB && products.length === 0 && (
            <p className="text-sm text-ink-faint col-span-full">No products in this category yet.</p>
          )}
          {activeCategory === COMBOS_TAB && combos.length === 0 && (
            <p className="text-sm text-ink-faint col-span-full">No combo meals configured yet.</p>
          )}
        </div>
      </div>

      {/* Right: cart / current order */}
      <div className="ticket p-4 flex flex-col min-h-0">
        <div className="flex gap-2 mb-4">
          {ORDER_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => dispatch(setOrderType(value))}
              className={clsx(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium border transition-colors',
                cart.orderType === value
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'border-ink/10 text-ink-muted'
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {cart.orderType === 'dine_in' && (
          <select
            value={cart.tableId ?? ''}
            onChange={(e) => dispatch(setTable(e.target.value || null))}
            className="mb-4 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          >
            <option value="">Select a table…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id} disabled={t.status === 'occupied' && t.id !== cart.tableId}>
                {t.name} ({t.status}) — seats {t.capacity}
              </option>
            ))}
          </select>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
          {cart.items.length === 0 && (
            <p className="text-sm text-ink-faint text-center py-10">Tap a product on the left to add it here.</p>
          )}
          {cart.items.map((item) => {
            const lineUnitPrice = item.price + item.addons.reduce((a, ad) => a + ad.price, 0);
            return (
              <div key={item.lineId} className="py-2 border-b border-ink/5 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.name}
                      {item.comboMealId && <span className="ml-1.5 text-[10px] uppercase text-amber-600 font-semibold">combo</span>}
                    </p>
                    {item.addons.length > 0 && (
                      <p className="text-xs text-ink-faint truncate">+ {item.addons.map((a) => a.name).join(', ')}</p>
                    )}
                    <p className="text-xs text-ink-faint">₹{lineUnitPrice.toFixed(0)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => dispatch(decrementItem(item.lineId))}
                      className="w-6 h-6 rounded-md bg-ink/5 flex items-center justify-center"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => dispatch(incrementItem(item.lineId))}
                      className="w-6 h-6 rounded-md bg-ink/5 flex items-center justify-center"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <p className="w-16 text-right text-sm font-medium">₹{(lineUnitPrice * item.quantity).toFixed(0)}</p>
                  <button onClick={() => dispatch(removeItem(item.lineId))} className="text-ink-faint hover:text-brick-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 mt-2 border-t border-dashed border-ink/15 space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-muted">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-ink-muted">
            <span>Discount %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={cart.discountPercent}
              onChange={(e) => dispatch(setDiscountPercent(Number(e.target.value)))}
              className="w-16 text-right rounded border border-ink/15 px-1.5 py-0.5"
            />
          </div>
          <div className="flex justify-between text-ink-muted">
            <span>Tax</span>
            <span>₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-display text-lg pt-1.5 border-t border-ink/10">
            <span>Total</span>
            <span>₹{grandTotal.toFixed(0)}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.items.length === 0 || (cart.orderType === 'dine_in' && !cart.tableId)}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-lg text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Receipt size={16} /> Charge ₹{grandTotal.toFixed(0)}
          </button>
          <button
            onClick={() => { setSplitCount(2); openSplitBill(); }}
            disabled={cart.items.length === 0 || (cart.orderType === 'dine_in' && !cart.tableId) || splitBusy}
            title="Split bill between guests"
            className="px-3 rounded-lg text-sm border border-ink/15 text-ink-muted disabled:opacity-40 flex items-center gap-1.5"
          >
            <Users size={16} />
          </button>
        </div>
      </div>

      {/* Addon/modifier picker */}
      {addonProduct && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="ticket p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <p className="font-display text-lg uppercase mb-1">{addonProduct.name}</p>
            <p className="text-xs text-ink-faint mb-4">Choose options, then add to cart.</p>

            {addonGroups.map((group) => (
              <div key={group.id} className="mb-4">
                <p className="text-xs uppercase text-ink-faint font-medium mb-2">
                  {group.name} {group.max_select > 1 ? `(up to ${group.max_select})` : ''}
                </p>
                <div className="space-y-1.5">
                  {group.options.map((opt) => {
                    const checked = selectedAddonIds.has(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleAddon(group, opt.id)}
                        className={clsx(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border',
                          checked ? 'border-amber-500 bg-amber-400/10' : 'border-ink/10'
                        )}
                      >
                        <span>{opt.name}</span>
                        <span className="text-ink-faint">+₹{Number(opt.price).toFixed(0)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setAddonProduct(null)} className="flex-1 py-2.5 rounded-lg text-sm border border-ink/15">
                Cancel
              </button>
              <button onClick={confirmAddonSelection} className="flex-1 py-2.5 rounded-lg text-sm bg-brand-500 text-white font-semibold">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="ticket p-6 w-full max-w-sm">
            <p className="font-display text-lg uppercase mb-1">Take Payment</p>
            <p className="text-sm text-ink-faint mb-4">Total due: <span className="font-semibold text-ink">₹{grandTotal.toFixed(0)}</span></p>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={clsx(
                    'py-2.5 rounded-lg text-sm font-medium capitalize border',
                    payMethod === m ? 'bg-amber-500 border-amber-500 text-brand-700' : 'border-ink/10 text-ink-muted'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCheckoutOpen(false)}
                className="flex-1 py-2.5 rounded-lg text-sm border border-ink/15 text-ink-muted"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceAndPay}
                disabled={placing}
                className="flex-1 py-2.5 rounded-lg text-sm bg-brand-500 text-white font-semibold disabled:opacity-60"
              >
                {placing ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split bill modal */}
      {splitOpen && splits && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="ticket p-6 w-full max-w-sm">
            <p className="font-display text-lg uppercase mb-1">Split Bill</p>
            <p className="text-xs text-ink-faint mb-4">Settle each guest's share separately — any payment method per guest.</p>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-ink-muted">Split into</span>
              <select
                value={splitCount}
                onChange={async (e) => {
                  setSplitCount(Number(e.target.value));
                  await openSplitBill();
                }}
                className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
              >
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} guests</option>)}
              </select>
            </div>

            <div className="space-y-2">
              {splits.map((split) => (
                <div key={split.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-ink/10">
                  <div>
                    <p className="text-sm font-medium">{split.split_label}</p>
                    <p className="text-xs text-ink-faint">₹{Number(split.amount).toFixed(0)}</p>
                  </div>
                  {split.is_paid ? (
                    <span className="text-xs font-medium text-sage-500 bg-sage-400/15 px-2.5 py-1 rounded-full">Paid</span>
                  ) : (
                    <div className="flex gap-1">
                      {(['cash', 'upi', 'card'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => handlePaySplit(split, m)}
                          disabled={splitBusy}
                          className="text-xs font-medium capitalize px-2 py-1.5 rounded-md bg-brand-500 text-white disabled:opacity-50"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => { setSplitOpen(false); setSplits(null); setActiveSplitOrderId(null); }}
              className="w-full mt-4 py-2.5 rounded-lg text-sm border border-ink/15 text-ink-muted"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {lastReceipt && (
        <div className="fixed bottom-6 right-6 ticket p-4 w-72 z-50">
          <p className="text-sm font-medium">Order {lastReceipt.orderNumber || ''} completed</p>
          {lastReceipt.total && <p className="text-xs text-ink-faint mt-0.5">Total charged: ₹{Number(lastReceipt.total).toFixed(0)}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handlePrint}
              disabled={receiptBusy === 'print'}
              className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md bg-ink/5 disabled:opacity-50"
            >
              <Printer size={12} /> Print
            </button>
            <button
              onClick={handleEmailReceipt}
              disabled={receiptBusy === 'email'}
              className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md bg-ink/5 disabled:opacity-50"
            >
              <Mail size={12} /> Email
            </button>
            <button
              onClick={handleWhatsappReceipt}
              disabled={receiptBusy === 'whatsapp'}
              className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md bg-ink/5 disabled:opacity-50"
            >
              <MessageCircle size={12} /> WhatsApp
            </button>
          </div>
          <button
            onClick={() => setLastReceipt(null)}
            className="w-full text-center text-xs text-ink-faint mt-2"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
