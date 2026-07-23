import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createCategorySchema, createProductSchema, updateProductSchema } from '../validators/menu.validators';
import {
  listCategories, createCategory, listProducts, createProduct, updateProduct, deleteProduct, getProductAddons,
  listCombos, createCombo, findProductByBarcode,
} from '../controllers/menu.controller';

const router = Router();
router.use(authenticate);

const canManageMenu = requireRole('super_admin', 'owner', 'manager');

router.get('/categories', listCategories);
router.post('/categories', canManageMenu, validate(createCategorySchema), createCategory);

router.get('/products', listProducts);
router.get('/products/barcode/:code', findProductByBarcode);
router.get('/products/:id/addons', getProductAddons);
router.get('/combos', listCombos);
router.post('/combos', canManageMenu, validate(z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  imageUrl: z.string().url().optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().positive() })).min(1),
})), createCombo);
router.post('/products', canManageMenu, validate(createProductSchema), createProduct);
router.patch('/products/:id', canManageMenu, validate(updateProductSchema), updateProduct);
router.delete('/products/:id', canManageMenu, deleteProduct);

export default router;
