import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerByIdSchema,
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
 * @route   GET /customers/search
 * @desc    Search customers
 * @access  CUSTOMER_VIEW permission
 */
router.get('/search', hasPermission('CUSTOMER_VIEW'), controller.search);

/**
 * @route   GET /customers/:id
 * @desc    Get customer by ID
 * @access  CUSTOMER_VIEW permission
 */
router.get('/:id', hasPermission('CUSTOMER_VIEW'), validate(getCustomerByIdSchema), controller.getById);

/**
 * @route   POST /customers
 * @desc    Create customer
 * @access  CUSTOMER_CREATE permission
 */
router.post('/', hasPermission('CUSTOMER_CREATE'), validate(createCustomerSchema), controller.create);

/**
 * @route   PUT /customers/:id
 * @desc    Update customer
 * @access  CUSTOMER_UPDATE permission
 */
router.put('/:id', hasPermission('CUSTOMER_UPDATE'), validate(updateCustomerSchema), controller.update);

/**
 * @route   DELETE /customers/:id
 * @desc    Delete customer
 * @access  CUSTOMER_DELETE permission
 */
router.delete('/:id', hasPermission('CUSTOMER_DELETE'), validate(getCustomerByIdSchema), controller.delete);

export default router;
