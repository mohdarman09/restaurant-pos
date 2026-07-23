import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listRawMaterials, createRawMaterial, recordStockMovement, listStockMovements,
  listSuppliers, createSupplier, createPurchaseOrder, receivePurchaseOrder,
} from '../controllers/inventory.controller';

const router = Router();
router.use(authenticate);
const canManageInventory = requireRole('super_admin', 'owner', 'manager');

router.get('/raw-materials', listRawMaterials);
router.post('/raw-materials', canManageInventory, validate(z.object({
  name: z.string().min(1), unitId: z.string().uuid(), reorderLevel: z.number().min(0).optional(),
})), createRawMaterial);

router.get('/stock-movements', listStockMovements);
router.post('/stock-movements', canManageInventory, validate(z.object({
  rawMaterialId: z.string().uuid(),
  movementType: z.enum(['stock_in', 'stock_out', 'adjustment', 'wastage', 'transfer_in', 'transfer_out']),
  quantity: z.number().positive(),
  notes: z.string().optional(),
  expiryDate: z.string().optional(),
  batchNo: z.string().optional(),
})), recordStockMovement);

router.get('/suppliers', listSuppliers);
router.post('/suppliers', canManageInventory, validate(z.object({
  name: z.string().min(1), contactPerson: z.string().optional(), phone: z.string().optional(),
  email: z.string().email().optional(), address: z.string().optional(), gstin: z.string().optional(),
})), createSupplier);

router.post('/purchase-orders', canManageInventory, validate(z.object({
  supplierId: z.string().uuid(),
  items: z.array(z.object({
    rawMaterialId: z.string().uuid(), quantity: z.number().positive(), unitPrice: z.number().nonnegative(),
  })).min(1),
})), createPurchaseOrder);
router.post('/purchase-orders/:id/receive', canManageInventory, receivePurchaseOrder);

export default router;
