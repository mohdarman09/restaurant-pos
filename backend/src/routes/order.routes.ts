import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createOrderSchema, addItemsSchema, applyDiscountSchema, checkoutSchema, createSplitsSchema, paySplitSchema,
} from '../validators/order.validators';
import {
  createOrder, addItems, applyDiscount, checkout, cancelOrder, listOrders, getOrder, createSplits, paySplit,
} from '../controllers/order.controller';
import { emailReceipt, whatsappReceiptLink, receiptText } from '../controllers/receipt.controller';

const router = Router();
router.use(authenticate);

router.get('/', listOrders);
router.get('/:id', getOrder);
router.post('/', validate(createOrderSchema), createOrder);
router.post('/:id/items', validate(addItemsSchema), addItems);
router.patch('/:id/discount', validate(applyDiscountSchema), applyDiscount);
router.post('/:id/checkout', validate(checkoutSchema), checkout);
router.patch('/:id/cancel', validate(z.object({ reason: z.string().optional() })), cancelOrder);
router.post('/:id/splits', validate(createSplitsSchema), createSplits);
router.patch('/:id/splits/:splitId/pay', validate(paySplitSchema), paySplit);

router.get('/:id/receipt/text', receiptText);
router.post('/:id/receipt/email', validate(z.object({ email: z.string().email() })), emailReceipt);
router.post('/:id/receipt/whatsapp', validate(z.object({ phone: z.string().min(6) })), whatsappReceiptLink);

export default router;
