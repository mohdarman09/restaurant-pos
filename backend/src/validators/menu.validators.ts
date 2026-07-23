import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  price: z.number().nonnegative(),
  costPrice: z.number().nonnegative().optional(),
  taxRateId: z.string().uuid().nullable().optional(),
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();
