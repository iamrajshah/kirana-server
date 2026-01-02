import { Router } from 'express';
import { OrderController } from './order.controller';
import { validate } from '@middlewares/validate.middleware';
import {
  getOrdersSchema,
  getOrderByIdSchema,
  updateOrderStatusSchema,
} from './order.validation';
import { extractTenant } from '@middlewares/tenant.middleware';
import { customerAuth } from '@middlewares/customer-auth.middleware';
import { authenticate } from '@middlewares/auth.middleware';

const router = Router();
const controller = new OrderController();

// Apply tenant middleware to all routes
router.use(extractTenant);

// Customer routes
router.post('/', customerAuth, controller.createOrder);
router.get('/', customerAuth, validate(getOrdersSchema), controller.getOrders);
router.get('/:id', customerAuth, validate(getOrderByIdSchema), controller.getOrderById);

// POS user routes (requires auth middleware)
router.patch('/:id/status', authenticate, validate(updateOrderStatusSchema), controller.updateOrderStatus);

export default router;
