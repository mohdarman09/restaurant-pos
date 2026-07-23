import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CartItem, SelectedAddon } from '../../types';

export type OrderType = 'dine_in' | 'take_away' | 'delivery';

interface PosState {
  orderType: OrderType;
  tableId: string | null;
  items: CartItem[];
  discountPercent: number;
  couponCode: string | null;
}

const initialState: PosState = {
  orderType: 'dine_in',
  tableId: null,
  items: [],
  discountPercent: 0,
  couponCode: null,
};

function addonsKey(addons: SelectedAddon[]): string {
  return addons.map((a) => a.id).sort().join(',');
}

const posSlice = createSlice({
  name: 'pos',
  initialState,
  reducers: {
    setOrderType(state, action: PayloadAction<OrderType>) {
      state.orderType = action.payload;
      if (action.payload !== 'dine_in') state.tableId = null;
    },
    setTable(state, action: PayloadAction<string | null>) {
      state.tableId = action.payload;
    },
    /** Adds a product to the cart. If it has no addons, merges into an existing identical line. */
    addItem(state, action: PayloadAction<{
      productId: string; name: string; price: number; taxRate: number; addons?: SelectedAddon[]; notes?: string;
    }>) {
      const addons = action.payload.addons ?? [];
      const existing = addons.length === 0
        ? state.items.find((i) => i.productId === action.payload.productId && i.addons.length === 0)
        : undefined;

      if (existing) {
        existing.quantity += 1;
        return;
      }

      state.items.push({
        lineId: `${action.payload.productId}:${addonsKey(addons)}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        productId: action.payload.productId,
        name: action.payload.name,
        price: action.payload.price,
        taxRate: action.payload.taxRate,
        quantity: 1,
        addons,
        notes: action.payload.notes,
      });
    },
    /** Adds a combo meal as its own cart line (combos always merge by comboMealId since they have no addons). */
    addComboItem(state, action: PayloadAction<{ comboMealId: string; name: string; price: number }>) {
      const existing = state.items.find((i) => i.comboMealId === action.payload.comboMealId);
      if (existing) {
        existing.quantity += 1;
        return;
      }
      state.items.push({
        lineId: `combo:${action.payload.comboMealId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        comboMealId: action.payload.comboMealId,
        name: action.payload.name,
        price: action.payload.price,
        taxRate: 0,
        quantity: 1,
        addons: [],
      });
    },
    incrementItem(state, action: PayloadAction<string>) {
      const item = state.items.find((i) => i.lineId === action.payload);
      if (item) item.quantity += 1;
    },
    decrementItem(state, action: PayloadAction<string>) {
      const item = state.items.find((i) => i.lineId === action.payload);
      if (item) {
        item.quantity -= 1;
        if (item.quantity <= 0) state.items = state.items.filter((i) => i.lineId !== action.payload);
      }
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.lineId !== action.payload);
    },
    setDiscountPercent(state, action: PayloadAction<number>) {
      state.discountPercent = action.payload;
    },
    setCouponCode(state, action: PayloadAction<string | null>) {
      state.couponCode = action.payload;
    },
    clearCart(state) {
      state.items = [];
      state.discountPercent = 0;
      state.couponCode = null;
      state.tableId = null;
    },
  },
});

export const {
  setOrderType, setTable, addItem, addComboItem, incrementItem, decrementItem, removeItem,
  setDiscountPercent, setCouponCode, clearCart,
} = posSlice.actions;
export default posSlice.reducer;
