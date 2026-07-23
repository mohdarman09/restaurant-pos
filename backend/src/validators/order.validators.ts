import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  comboMealId: z.string().uuid().optional(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().positive(),
  addonIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional(),
}).refine((item) => !!item.productId !== !!item.comboMealId, {
  message: 'Provide exactly one of productId or comboMealId',
});

export const createOrderSchema = z.object({
  orderType: z.enum(['dine_in', 'take_away', 'delivery']),
  tableId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  waiterId: z.string().uuid().nullable().optional(),
  items: z.array(orderItemSchema).min(1),
});

export const addItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1),
});

export const applyDiscountSchema = z.object({
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  couponCode: z.string().optional(),
});

export const checkoutSchema = z.object({
  payments: z.array(z.object({
    method: z.enum(['cash', 'card', 'upi', 'wallet', 'mixed']),
    amount: z.number().positive(),
    referenceNo: z.string().optional(),
  })).min(1),
  serviceChargeId: z.string().uuid().nullable().optional(),
});

export const createSplitsSchema = z.object({
  splits: z.array(z.object({
    label: z.string().min(1),
    amount: z.number().positive(),
  })).min(2),
});

export const paySplitSchema = z.object({
  method: z.enum(['cash', 'card', 'upi', 'wallet']),
  referenceNo: z.string().optional(),
});

export const holdOrderSchema = z.object({
  orderType: z.enum(['dine_in', 'take_away', 'delivery']),
  tableId: z.string().uuid().nullable().optional(),
});
