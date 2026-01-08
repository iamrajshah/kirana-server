import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerByIdSchema,
  addOpeningBalanceSchema,
  getCustomerLedgerSchema,
  updateCustomerStatusSchema,
} from './customer.validation';

const router = Router();
const controller = new CustomerController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   GET /customers
 * @desc    Get all customers
 * @access  CUSTOMER_VIEW permission
 */
router.get('/', hasPermission('CUSTOMER_VIEW'), controller.getAll);

/**
 * @route   GET /customers/:id
 * @desc    Get customer by ID
 * @access  CUSTOMER_VIEW permission
 */
router.get(
  '/:id',
  hasPermission('CUSTOMER_VIEW'),
  validate(getCustomerByIdSchema),
  controller.getById
);

/**
 * @route   POST /customers
 * @desc    Create customer
 * @access  CUSTOMER_CREATE permission
 */
router.post(
  '/',
  hasPermission('CUSTOMER_CREATE'),
  validate(createCustomerSchema),
  controller.create
);

/**
 * @route   PATCH /customers/:id
 * @desc    Update customer
 * @access  CUSTOMER_UPDATE permission
 */
router.patch(
  '/:id',
  hasPermission('CUSTOMER_UPDATE'),
  validate(updateCustomerSchema),
  controller.update
);

/**
 * @route   PATCH /customers/:id/status
 * @desc    Update customer status
 * @access  CUSTOMER_UPDATE permission
 */
router.patch(
  '/:id/status',
  hasPermission('CUSTOMER_UPDATE'),
  validate(updateCustomerStatusSchema),
  controller.updateCustomerStatus
);

/**
 * @route   POST /customers/:id/opening-balance
 * @desc    Add opening balance to customer
 * @access  CUSTOMER_UPDATE permission
 */
router.post(
  '/:id/opening-balance',
  hasPermission('CUSTOMER_UPDATE'),
  validate(addOpeningBalanceSchema),
  controller.addOpeningBalance
);

/**
 * @route   GET /customers/:id/ledger
 * @desc    Get customer ledger
 * @access  CUSTOMER_VIEW permission
 */
router.get(
  '/:id/ledger',
  hasPermission('CUSTOMER_VIEW'),
  validate(getCustomerLedgerSchema),
  controller.getCustomerLedger
);

export default router;
