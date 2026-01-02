import { Router } from 'express';
import { CustomerAuthController } from './customer-auth.controller';
import { extractTenant } from '@middlewares/tenant.middleware';
import { customerAuth } from '@middlewares/customer-auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { customerRegisterSchema, customerLoginSchema } from './customer.validation';

const router = Router();
const controller = new CustomerAuthController();

// Apply tenant middleware to all routes
router.use(extractTenant);

/**
 * @route   POST /customer-auth/register
 * @desc    Register new customer
 * @access  Public
 */
router.post('/register', validate(customerRegisterSchema), controller.register);

/**
 * @route   POST /customer-auth/login
 * @desc    Customer login
 * @access  Public
 */
router.post('/login', validate(customerLoginSchema), controller.login);

/**
 * @route   GET /customer-auth/me
 * @desc    Get customer profile
 * @access  Customer authenticated
 */
router.get('/me', customerAuth, controller.getProfile);

export default router;
