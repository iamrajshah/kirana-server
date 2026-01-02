import { Router } from 'express';
import { SupplierController } from './supplier.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createSupplierSchema,
  updateSupplierSchema,
  getSupplierByIdSchema,
  addOpeningBalanceSchema,
  getSupplierLedgerSchema,
  makePaymentSchema,
} from './supplier.validation';

const router = Router();
const controller = new SupplierController();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /suppliers
 * @desc    Create supplier
 * @access  OWNER, MANAGER (SUPPLIER_CREATE permission)
 */
router.post(
  '/',
  hasPermission('SUPPLIER_CREATE'),
  validate(createSupplierSchema),
  controller.create
);

/**
 * @route   GET /suppliers
 * @desc    Get all suppliers
 * @access  OWNER, MANAGER, CASHIER (SUPPLIER_VIEW permission)
 */
router.get('/', hasPermission('SUPPLIER_VIEW'), controller.getAll);

/**
 * @route   GET /suppliers/:id
 * @desc    Get supplier by ID with balance
 * @access  OWNER, MANAGER, CASHIER (SUPPLIER_VIEW permission)
 */
router.get(
  '/:id',
  hasPermission('SUPPLIER_VIEW'),
  validate(getSupplierByIdSchema),
  controller.getById
);

/**
 * @route   PATCH /suppliers/:id
 * @desc    Update supplier
 * @access  OWNER, MANAGER (SUPPLIER_UPDATE permission)
 */
router.patch(
  '/:id',
  hasPermission('SUPPLIER_UPDATE'),
  validate(updateSupplierSchema),
  controller.update
);

/**
 * @route   POST /suppliers/:id/opening-balance
 * @desc    Add opening balance for supplier
 * @access  OWNER, MANAGER (SUPPLIER_MANAGE permission)
 */
router.post(
  '/:id/opening-balance',
  hasPermission('SUPPLIER_MANAGE'),
  validate(addOpeningBalanceSchema),
  controller.addOpeningBalance
);

/**
 * @route   GET /suppliers/:id/ledger
 * @desc    Get supplier ledger entries
 * @access  OWNER, MANAGER, CASHIER (SUPPLIER_VIEW permission)
 */
router.get(
  '/:id/ledger',
  hasPermission('SUPPLIER_VIEW'),
  validate(getSupplierLedgerSchema),
  controller.getLedger
);

/**
 * @route   POST /suppliers/:id/payments
 * @desc    Make payment to supplier
 * @access  OWNER, MANAGER (SUPPLIER_MANAGE permission)
 */
router.post(
  '/:id/payments',
  hasPermission('SUPPLIER_MANAGE'),
  validate(makePaymentSchema),
  controller.makePayment
);

export default router;
