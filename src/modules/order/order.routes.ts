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

/**
 * @route   POST /order
 * @desc    Create new order
 * @access  Customer authenticated
 */
router.post('/', customerAuth, controller.createOrder);

/**
 * @route   GET /order
 * @desc    Get customer orders
 * @access  Customer authenticated
 */
router.get('/', customerAuth, validate(getOrdersSchema), controller.getOrders);

/**
 * @route   GET /order/:id
 * @desc    Get order by ID
 * @access  Customer authenticated
 */
router.get('/:id', customerAuth, validate(getOrderByIdSchema), controller.getOrderById);

/**
 * @route   POST /order/:id/cancel
 * @desc    Cancel order
 * @access  Customer authenticated
 */
router.post('/:id/cancel', customerAuth, validate(getOrderByIdSchema), controller.cancelOrder);

/**
 * @route   GET /order/:id/status
 * @desc    Get order status
 * @access  Customer authenticated
 */
router.get('/:id/status', customerAuth, validate(getOrderByIdSchema), controller.getOrderStatus);

/**
 * @route   PATCH /order/:id/status
 * @desc    Update order status (POS users only)
 * @access  POS authenticated
 */
router.patch('/:id/status', authenticate, validate(updateOrderStatusSchema), controller.updateOrderStatus);

export default router;
