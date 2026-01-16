import { Router } from 'express';
import { BankAccountController } from './bank-account.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  getBankAccountByIdSchema,
  getBankAccountsSchema,
  setPrimaryBankAccountSchema,
  deleteBankAccountSchema,
} from './bank-account.validation';

const router = Router();
const controller = new BankAccountController();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /suppliers/:supplierId/bank-accounts
 * @desc    Create supplier bank account
 * @access  OWNER, MANAGER (SUPPLIER_MANAGE permission)
 */
router.post(
  '/:supplierId/bank-accounts',
  hasPermission('SUPPLIER_MANAGE'),
  validate(createBankAccountSchema),
  controller.create
);

/**
 * @route   GET /suppliers/:supplierId/bank-accounts
 * @desc    Get all bank accounts for a supplier
 * @access  OWNER, MANAGER, CASHIER (SUPPLIER_VIEW permission)
 */
router.get(
  '/:supplierId/bank-accounts',
  hasPermission('SUPPLIER_VIEW'),
  validate(getBankAccountsSchema),
  controller.getAll
);

/**
 * @route   GET /suppliers/:supplierId/bank-accounts/:bankAccountId
 * @desc    Get bank account by ID
 * @access  OWNER, MANAGER, CASHIER (SUPPLIER_VIEW permission)
 */
router.get(
  '/:supplierId/bank-accounts/:bankAccountId',
  hasPermission('SUPPLIER_VIEW'),
  validate(getBankAccountByIdSchema),
  controller.getById
);

/**
 * @route   PUT /suppliers/:supplierId/bank-accounts/:bankAccountId
 * @desc    Update bank account
 * @access  OWNER, MANAGER (SUPPLIER_MANAGE permission)
 */
router.put(
  '/:supplierId/bank-accounts/:bankAccountId',
  hasPermission('SUPPLIER_MANAGE'),
  validate(updateBankAccountSchema),
  controller.update
);

/**
 * @route   DELETE /suppliers/:supplierId/bank-accounts/:bankAccountId
 * @desc    Delete bank account (soft delete)
 * @access  OWNER, MANAGER (SUPPLIER_MANAGE permission)
 */
router.delete(
  '/:supplierId/bank-accounts/:bankAccountId',
  hasPermission('SUPPLIER_MANAGE'),
  validate(deleteBankAccountSchema),
  controller.delete
);

/**
 * @route   POST /suppliers/:supplierId/bank-accounts/:bankAccountId/set-primary
 * @desc    Set bank account as primary
 * @access  OWNER, MANAGER (SUPPLIER_MANAGE permission)
 */
router.post(
  '/:supplierId/bank-accounts/:bankAccountId/set-primary',
  hasPermission('SUPPLIER_MANAGE'),
  validate(setPrimaryBankAccountSchema),
  controller.setPrimary
);

export default router;
