import { Router } from 'express';
import { InvoiceController } from './invoice.controller';
import { asyncHandler } from '@utils/asyncHandler';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createInvoiceSchema,
  getInvoiceByIdSchema,
  getCustomerInvoicesSchema,
} from './invoice.validation';

const router = Router();
const invoiceController = new InvoiceController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

// POST /invoices - Create invoice (BILL_CREATE permission - OWNER/MANAGER/CASHIER)
router.post(
  '/',
  hasPermission('BILL_CREATE'),
  validate(createInvoiceSchema),
  asyncHandler(invoiceController.createInvoice)
);

// GET /invoices - Get all invoices (BILL_VIEW permission)
router.get('/', hasPermission('BILL_VIEW'), asyncHandler(invoiceController.getAllInvoices));

// GET /invoices/:id - Get invoice by ID (BILL_VIEW permission)
router.get(
  '/:id',
  hasPermission('BILL_VIEW'),
  validate(getInvoiceByIdSchema),
  asyncHandler(invoiceController.getInvoiceById)
);

// GET /customers/:customerId/invoices - Get invoices by customer (BILL_VIEW permission)
router.get(
  '/customers/:customerId/invoices',
  hasPermission('BILL_VIEW'),
  validate(getCustomerInvoicesSchema),
  asyncHandler(invoiceController.getInvoicesByCustomer)
);

export default router;
