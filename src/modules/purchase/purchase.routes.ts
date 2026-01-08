import { Router } from 'express';
import { PurchaseController } from './purchase.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createPurchaseSchema,
  getPurchaseByIdSchema,
  getPurchasesSchema,
} from './purchase.validation';

const router = Router();
const controller = new PurchaseController();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /purchases
 * @desc    Create purchase invoice
 * @access  OWNER, MANAGER (PURCHASE_CREATE permission)
 */
router.post(
  '/',
  hasPermission('PURCHASE_CREATE'),
  validate(createPurchaseSchema),
  controller.create
);

/**
 * @route   GET /purchases
 * @desc    Get all purchases
 * @access  OWNER, MANAGER, CASHIER (PURCHASE_VIEW permission)
 */
router.get('/', hasPermission('PURCHASE_VIEW'), validate(getPurchasesSchema), controller.getAll);

/**
 * @route   GET /purchases/:id
 * @desc    Get purchase by ID
 * @access  OWNER, MANAGER, CASHIER (PURCHASE_VIEW permission)
 */
router.get(
  '/:id',
  hasPermission('PURCHASE_VIEW'),
  validate(getPurchaseByIdSchema),
  controller.getById
);

export default router;
