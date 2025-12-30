import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { asyncHandler } from '@utils/asyncHandler';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createPaymentSchema,
  getPaymentByIdSchema,
  getCustomerPaymentsSchema,
} from './payment.validation';

const router = Router();
const paymentController = new PaymentController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

// POST /payments - Create payment (BILL_CREATE permission - OWNER/MANAGER/CASHIER)
router.post(
  '/',
  hasPermission('BILL_CREATE'),
  validate(createPaymentSchema),
  asyncHandler(paymentController.createPayment)
);

// GET /payments - Get all payments (BILL_VIEW permission)
router.get('/', hasPermission('BILL_VIEW'), asyncHandler(paymentController.getAllPayments));

// GET /payments/:id - Get payment by ID (BILL_VIEW permission)
router.get(
  '/:id',
  hasPermission('BILL_VIEW'),
  validate(getPaymentByIdSchema),
  asyncHandler(paymentController.getPaymentById)
);

// GET /customers/:customerId/payments - Get payments by customer (BILL_VIEW permission)
router.get(
  '/customers/:customerId/payments',
  hasPermission('BILL_VIEW'),
  validate(getCustomerPaymentsSchema),
  asyncHandler(paymentController.getPaymentsByCustomer)
);

export default router;
