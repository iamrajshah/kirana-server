import { Router } from 'express';
import { InvoiceController } from './invoice.controller';
import { extractTenant } from '@middlewares/tenant.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createInvoiceFromOrderSchema,
  updateInvoiceItemsSchema,
  finalizeInvoiceSchema,
  getInvoiceByIdSchema,
} from './invoice.validation';

const router = Router();
const controller = new InvoiceController();

// Apply tenant middleware to all routes
router.use(extractTenant);

// POS routes - Create invoice from order
router.post(
  '/from-order/:orderId',
  authenticate,
  validate(createInvoiceFromOrderSchema),
  controller.createInvoiceFromOrder
);

// POS routes - Edit invoice items
router.patch(
  '/:id/items',
  authenticate,
  validate(updateInvoiceItemsSchema),
  controller.updateInvoiceItems
);

// POS routes - Finalize invoice
router.post(
  '/:id/finalize',
  authenticate,
  validate(finalizeInvoiceSchema),
  controller.finalizeInvoice
);

// Get invoice details (accessible without auth for now, or add middleware if needed)
router.get('/:id', validate(getInvoiceByIdSchema), controller.getInvoice);

export default router;
