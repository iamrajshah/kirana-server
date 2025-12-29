import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { authenticate } from '@middlewares/auth.middleware';
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

// Routes
router.get('/', controller.getAll);
router.get('/search', controller.search);
router.get('/:id', validate(getCustomerByIdSchema), controller.getById);
router.post('/', validate(createCustomerSchema), controller.create);
router.put('/:id', validate(updateCustomerSchema), controller.update);
router.delete('/:id', validate(getCustomerByIdSchema), controller.delete);

export default router;
