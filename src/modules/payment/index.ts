import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { extractTenant } from '@middlewares/tenant.middleware';
import { customerAuth } from '@middlewares/customer-auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createPaymentIntentSchema,
  getPaymentsByInvoiceSchema,
  createPaymentSchema,
} from './payment.validation';

const router = Router();
const controller = new PaymentController();

// Apply tenant middleware to all routes
router.use(extractTenant);

// Customer routes - Create payment intent
router.post(
  '/intent',
  customerAuth,
  validate(createPaymentIntentSchema),
  controller.createPaymentIntent
);

// Customer routes - Create payment
router.post(
  '/',
  customerAuth,
  validate(createPaymentSchema),
  controller.createPayment
);

// Customer routes - Get payments by invoice
router.get(
  '/',
  customerAuth,
  validate(getPaymentsByInvoiceSchema),
  controller.getPaymentsByInvoice
);

export default router;
